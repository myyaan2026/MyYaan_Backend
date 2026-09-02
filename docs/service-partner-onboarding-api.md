# Profile, Address, and Service Partner API

Base URL: `http://localhost:5001/api`

All endpoints below require `Authorization: Bearer <authToken>`. The user ID
comes from the token. Never send `userId`. GET identifiers use query
parameters; PUT and POST identifiers use JSON bodies.

## Common personal profile

```http
GET /users/profile
PUT /users/profile
```

```json
{
  "profilePicUrl": "https://storage.example.com/profile.jpg",
  "firstName": "Ayush",
  "lastName": "Bansal",
  "email": "ayush@example.com",
  "alternativeMobile": "9876543210"
}
```

## Consumer addresses

```http
GET /users/addresses
GET /users/address?addressId=10
POST /users/addresses
PUT /users/addresses
DELETE /users/address?addressId=10
```

POST body:

```json
{
  "addressLabel": "Home",
  "addressLine1": "123 Main Road",
  "addressLine2": "Near City Mall",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "latitude": 28.6139,
  "longitude": 77.209,
  "isDefault": true
}
```

PUT uses the same fields plus `"addressId": 10` in the body.

## Service catalog

```http
GET /services
GET /service?serviceId=1
```

## Service-partner onboarding

```http
GET /service-partners/onboarding
```

Returns the three completion flags and `isProfileUpdated`.

## Service centres

```http
GET /service-partners/service-centres
GET /service-partners/service-centre?serviceCenterId=10
POST /service-partners/service-centres
PUT /service-partners/service-centres
```

POST body:

```json
{
  "serviceCenterName": "MyYaan Service Centre",
  "serviceCenterPicUrl": "https://storage.example.com/centre.jpg",
  "addressLine1": "123 Main Road",
  "addressLine2": "Near City Mall",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "latitude": 28.6139,
  "longitude": 77.209
}
```

POST returns `serviceCenterId`. PUT uses the same fields plus
`"serviceCenterId": 10` in the body.

## Services offered by a centre

```http
GET /service-partners/services?serviceCenterId=10
PUT /service-partners/services
```

```json
{
  "serviceCenterId": 10,
  "serviceIds": [1, 3]
}
```

PUT replaces the centre's previous service selection.
