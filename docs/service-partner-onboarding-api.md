# Profile, Address, and Service Partner API

Base URL: `http://localhost:3001/api` (or the port configured by `PORT`)

All endpoints below require `Authorization: Bearer <authToken>`. The user ID
comes from the token. Never send `userId`. GET identifiers use query
parameters; PUT and POST identifiers use JSON bodies.

## Common personal profile

```http
GET /users/profile
PUT /users/profile
GET /service-partners/personal-details
PUT /service-partners/personal-details
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

## Single-centre service-partner compatibility API

These endpoints match the original service-app contract. The authenticated
partner's first active service centre is used automatically, so the client does
not send `serviceCenterId`.

```http
GET /service-partners/service-centre-address
PUT /service-partners/service-centre-address
GET /service-partners/services
PUT /service-partners/services
```

The centre-address PUT accepts the service-centre body shown below. It creates
the centre on the first call and updates it on later calls. The services PUT
body is:

```json
{
  "serviceIds": [1, 3]
}
```

Personal details are shared profile data. Service-centre details and service
selection require a `service_partner` account. Consumer delivery/service
addresses remain under the separate `/users/addresses` API.

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
GET /service-partners/service-centres/services?serviceCenterId=10
PUT /service-partners/service-centres/services
```

```json
{
  "serviceCenterId": 10,
  "serviceIds": [1, 3]
}
```

PUT replaces the centre's previous service selection.
