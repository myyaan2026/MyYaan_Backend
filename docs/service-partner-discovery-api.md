# Service partner discovery

All endpoints require a Bearer token.

## User: find nearby service partners

```text
GET /api/users/service-partners?vehicleId=12&serviceId=2&subServiceId=4&latitude=28.6139&longitude=77.2090&distanceKm=8
```

Every query parameter is required. `distanceKm` is user-selected (greater than zero and up to 500), not hard-coded. The result only includes active centres that offer the selected service and sub-service, are inside the radius, and support the selected vehicle model when they have configured vehicle support.

## Service partner: sub-service capabilities

```text
GET /api/service-partners/capabilities/sub-services?serviceCenterId=1&serviceId=2
PUT /api/service-partners/capabilities/sub-services
```

```json
{
  "serviceCenterId": 1,
  "serviceId": 2,
  "subServiceIds": [4, 5, 6]
}
```

## Service partner: supported models

```text
GET /api/service-partners/capabilities/vehicles?serviceCenterId=1&serviceId=2&vehicleType=BIKE
PUT /api/service-partners/capabilities/vehicles
```

```json
{
  "serviceCenterId": 1,
  "serviceId": 2,
  "vehicleType": "BIKE",
  "modelIds": [1, 2, 3]
}
```

The PUT requests replace the configured capability list for that service centre, service, and vehicle category.
