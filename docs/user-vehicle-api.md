# User vehicle APIs

All endpoints below require `Authorization: Bearer <authToken>` from the normal-user OTP flow.

## Fetch selection data

```text
GET /api/users/vehicle-types
GET /api/users/vehicle-companies?vehicleType=Bike
GET /api/users/vehicle-models?vehicleType=Bike&companyId=1
```

`vehicleType` accepts `Bike`, `Electric Bike`, `Car`, and `Electric Car` (the API also accepts the corresponding uppercase codes). `companyId` is optional for `vehicle-models`; omit it to fetch every model for the selected vehicle type.

## Save and fetch the user's selection

```text
PUT /api/users/vehicle-details
GET /api/users/vehicle-details
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

The server normalizes the registration number to uppercase without spaces and verifies that the selected model belongs to the selected company and vehicle type. Saving again replaces the user's current vehicle details.

## OTP response

`POST /api/users/verify-otp` now includes `isVehicleDetailsFilled` in `data`. It is `false` until the user saves vehicle details and remains correct if the user updates them later.
