# User vehicle APIs

All endpoints below require `Authorization: Bearer <authToken>` from the normal-user OTP flow.

## Fetch selection data

```text
GET /api/users/vehicle-types
GET /api/users/vehicle-companies?vehicleType=Bike
GET /api/users/vehicle-models?vehicleType=Bike&companyId=1
```

`vehicleType` accepts `Bike`, `Electric Bike`, `Car`, and `Electric Car` (the API also accepts the corresponding uppercase codes). `companyId` is optional for `vehicle-models`; omit it to fetch every model for the selected vehicle type.

- `GET /api/users/vehicle-companies` returns `companyId`, `companyName`, `companyShortName`, `companyLongName`, and `logoUrl`.
- `GET /api/users/vehicle-models` returns `modelId`, `modelName`, `modelShortName`, `modelLongName`, `engineCc`, `imageUrl`, `companyId`, `companyName`, and `companyLogoUrl`.

## Manage the user's vehicles

```text
GET /api/users/vehicle-details
POST /api/users/vehicle-details
GET /api/users/vehicle-details/:vehicleId
PUT /api/users/vehicle-details/:vehicleId
PATCH /api/users/vehicle-details/:vehicleId/primary
DELETE /api/users/vehicle-details/:vehicleId
```

Example request body:

```json
{
  "vehicleType": "Bike",
  "companyId": 1,
  "modelId": 1,
  "vehicleNumber": "DL 01 AB 1234"
}
```

The server normalizes the registration number to uppercase without spaces and verifies that the selected model belongs to the selected company and vehicle type. `POST` adds a vehicle; the first one automatically becomes primary. Include `"isPrimary": true` to make a newly added or updated vehicle primary.

## Start booking a service

```text
GET /api/users/service-booking-options?serviceId=2
```

The response includes the primary vehicle, selected service, and only enabled sub-service types (Walk In Service, PickNDrop, Home Service). If no vehicle exists it responds with HTTP `409` and `data.code` equal to `VEHICLE_DETAILS_REQUIRED`.

It also includes every enabled `serviceOption`, with `isDefaultSelected: true` on the option that should be selected first. For Bike/Car Service this is General Service; for Puncture and Running Repair it is the matching option.

Each service option includes `tags` (for example, `Most Booked` or `Best Value`), `shortDescription`, `fullDescription`, `checklist` (a string array), `basePrice`, `estimatedDurationMinutes`, `warrantyDescription`, and `additionalChargeNote`. The puncture option includes the additional-tyre charge note.

To book for a vehicle other than the primary one (for example, after the user selects Bike or Car), send its id too: `GET /api/users/service-booking-options?serviceId=6&vehicleId=12`. The response includes both `selectedVehicle` and the full `vehicles` list.

The API derives Bike or Car from `vehicleId`; do not send a separate `vehicleType` query parameter. For shared services such as Puncture and Running Repair, it returns only the corresponding Bike or Car service-option cards and their complete checklists.

## Home screen services

```text
GET /api/users/home/services
```

This returns enabled home-screen services, including Bike Service, Car Service, Bike Washing, Car Washing, Running Repair, and Puncture. These are managed with `service_types.is_home_enabled`; services and their options can be added or disabled in the database without changing the API.

## OTP response

`POST /api/users/verify-otp` now includes `isVehicleDetailsFilled` in `data`. It is `false` until the user saves vehicle details and remains correct if the user updates them later.
