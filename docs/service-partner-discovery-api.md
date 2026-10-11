# Service Partner Discovery & Booking Flow API

All endpoints require a Bearer token (`Authorization: Bearer <jwt_token>`).

---

## 1. Discover Nearby Service Partners (with Custom Pricing & Commission)

Returns nearby active service partners filtered by location, vehicle model compatibility, service, and delivery mode (`subServiceId`).

### Pricing Calculation Rules
1. **Walk-In Service (`WALK_IN`)**:
   - `price` = `walkInPrice` + `commissionAmount`
2. **Pick & Drop (`PICK_N_DROP`)**:
   - `price` = `walkInPrice` + `pickDropCharge` + `commissionAmount`
   *(Example: Base 200 + PickDrop 200 + Commission 50 = 450)*
3. **Home Service (`HOME_SERVICE`)**:
   - `price` = `homeServicePrice` + `commissionAmount`
   *(Example: Home 500 + Commission 50 = 550)*

```http
GET /api/users/service-partners?vehicleId=1&serviceId=2&subServiceId=4&serviceOptionId=10&latitude=28.6139000&longitude=77.2090000&distanceKm=5
```

### Success Response (`200 OK`)
```json
{
  "code": 200,
  "message": "Nearby service partners fetched successfully",
  "data": {
    "selectedOption": {
      "serviceOptionId": 10,
      "serviceOptionName": "General Service",
      "basePrice": "200.00"
    },
    "subService": {
      "subServiceId": 4,
      "subServiceCode": "PICK_N_DROP",
      "subServiceName": "PickNDrop"
    },
    "partners": [
      {
        "servicePartnerId": 4,
        "serviceCenterId": 4,
        "name": "Test Service Center",
        "address": "Suncity Avenue 102, Sector 102, Gurugram, Haryana, 122001",
        "latitude": 28.6139,
        "longitude": 77.209,
        "distanceKm": 0,
        "price": 450,
        "priceBreakup": {
          "basePrice": 200,
          "deliveryCharge": 200,
          "deliveryType": "PICK_N_DROP",
          "commission": 50,
          "finalPrice": 450
        },
        "serviceCenterImage": "https://storage.example.com/centre.jpg",
        "serviceOptionId": 10,
        "serviceOptionName": "General Service"
      }
    ]
  }
}
```

---

## 2. Get Available Time Slots (Default 1-Week Schedule)

Retrieves available 2-hour slots. **The `date` parameter is now optional**.
When `date` is omitted, the API returns a **full 7-day schedule (one week)** starting today.
- Past slots on the current day are excluded.
- Fully booked slots (exceeding center slot capacity) are excluded.

```http
GET /api/users/bookings/available-slots?serviceCenterId=4
```
*(Optional: `&date=2026-10-01` to query a specific single date).*

### Success Response (`200 OK`)
```json
{
  "code": 200,
  "message": "Available time slots fetched successfully",
  "data": {
    "serviceCenterId": 4,
    "startDate": "2026-10-01",
    "endDate": "2026-10-07",
    "days": [
      {
        "date": "2026-10-01",
        "dayName": "Thursday",
        "availableSlots": [
          {
            "slotId": "09:00-11:00",
            "display": "09:00 AM - 11:00 AM",
            "startTime": "09:00:00",
            "endTime": "11:00:00",
            "durationHours": 2
          },
          {
            "slotId": "11:00-13:00",
            "display": "11:00 AM - 01:00 PM",
            "startTime": "11:00:00",
            "endTime": "13:00:00",
            "durationHours": 2
          },
          {
            "slotId": "13:00-15:00",
            "display": "01:00 PM - 03:00 PM",
            "startTime": "13:00:00",
            "endTime": "15:00:00",
            "durationHours": 2
          },
          {
            "slotId": "15:00-17:00",
            "display": "03:00 PM - 05:00 PM",
            "startTime": "15:00:00",
            "endTime": "17:00:00",
            "durationHours": 2
          },
          {
            "slotId": "17:00-19:00",
            "display": "05:00 PM - 07:00 PM",
            "startTime": "17:00:00",
            "endTime": "19:00:00",
            "durationHours": 2
          }
        ]
      },
      {
        "date": "2026-10-02",
        "dayName": "Friday",
        "availableSlots": [ ... ]
      }
    ]
  }
}
```

---

## 3. List Available Coupons & Apply Coupon

### A. List Active Coupons
```http
GET /api/users/coupons
```

### B. Apply Coupon Code (Standalone Validation)
```http
POST /api/users/coupons/apply
Content-Type: application/json

{
  "couponCode": "FIRST50",
  "orderAmount": 450
}
```

---

## 4. Booking Review Page (with Dynamic Payment Breakup & Coupon Refresh)

Provides the complete payment breakup details. Passing `couponCode` refreshes the discount and final payable amount instantly.

```http
POST /api/users/bookings/review
Content-Type: application/json

{
  "serviceCenterId": 4,
  "vehicleId": 1,
  "serviceId": 2,
  "subServiceId": 4,
  "serviceOptionId": 10,
  "bookingDate": "2026-10-02",
  "bookingTimeSlot": "09:00 AM - 11:00 AM",
  "couponCode": "FIRST50"
}
```

### Success Response (`200 OK`)
```json
{
  "code": 200,
  "message": "Booking review details fetched successfully",
  "data": {
    "status": "ok",
    "serviceCenter": {
      "serviceCenterId": 4,
      "name": "Test Service Center",
      "address": "Suncity Avenue 102, Sector 102, Gurugram, Haryana, 122001",
      "serviceCenterImage": "https://storage.example.com/centre.jpg"
    },
    "vehicle": {
      "vehicleId": 1,
      "vehicleType": "BIKE",
      "vehicleNumber": "DL01AB1234",
      "companyName": "Bajaj",
      "modelName": "Pulsar 150"
    },
    "service": {
      "serviceId": 2,
      "serviceName": "Bike Service",
      "subServiceId": 4,
      "subServiceName": "PickNDrop",
      "serviceOptionId": 10,
      "serviceOptionName": "General Service"
    },
    "slot": {
      "date": "2026-10-02",
      "timeSlot": "09:00 AM - 11:00 AM",
      "startTime": "09:00:00",
      "endTime": "11:00:00"
    },
    "pricing": {
      "basePrice": 200,
      "deliveryCharge": 200,
      "deliveryType": "PICK_N_DROP",
      "commissionAmount": 50,
      "subtotal": 450,
      "discountAmount": 100,
      "coupon": {
        "couponCode": "FIRST50",
        "title": "First Ride Special",
        "discountAmount": 100
      },
      "finalAmount": 350
    },
    "paymentModes": ["PAY_NOW", "PAY_LATER"]
  }
}
```

---

## 5. Confirm Service Booking (Only Required Details)

Places the confirmed booking. Returns only required, clean booking details.

```http
POST /api/users/bookings
Content-Type: application/json

{
  "serviceCenterId": 4,
  "vehicleId": 1,
  "serviceId": 2,
  "subServiceId": 4,
  "serviceOptionId": 10,
  "bookingDate": "2026-10-02",
  "bookingTimeSlot": "09:00 AM - 11:00 AM",
  "paymentMode": "PAY_LATER",
  "couponCode": "FIRST50",
  "notes": "Please check brake wire"
}
```

### Success Response (`201 Created`)
```json
{
  "code": 201,
  "message": "Service booking created successfully",
  "data": {
    "bookingId": 12,
    "bookingNumber": "BK20261002A1B2C3",
    "bookingStatus": "CONFIRMED",
    "bookingDate": "2026-10-02",
    "bookingTimeSlot": "09:00 AM - 11:00 AM",
    "serviceCenter": {
      "serviceCenterId": 4,
      "name": "Test Service Center",
      "address": "Suncity Avenue 102, Sector 102, Gurugram, Haryana, 122001",
      "serviceCenterImage": "https://storage.example.com/centre.jpg"
    },
    "vehicle": {
      "vehicleId": 1,
      "vehicleNumber": "DL01AB1234",
      "companyName": "Bajaj",
      "modelName": "Pulsar 150"
    },
    "service": {
      "serviceName": "Bike Service",
      "subServiceName": "PickNDrop",
      "serviceOptionName": "General Service"
    },
    "pricing": {
      "basePrice": 200,
      "deliveryCharge": 200,
      "deliveryType": "PICK_N_DROP",
      "commissionAmount": 50,
      "subtotal": 450,
      "discountAmount": 100,
      "couponCode": "FIRST50",
      "finalAmount": 350
    },
    "paymentMode": "PAY_LATER",
    "paymentStatus": "PENDING",
    "notes": "Please check brake wire",
    "createdAt": "2026-10-01T09:30:00Z"
  }
}
```

---

## 6. Cancel / Delete Confirmed Booking

Users can cancel/delete their confirmed booking:

```http
DELETE /api/users/bookings/12
Content-Type: application/json

{
  "reason": "Changed my schedule"
}
```
*(Alternative alias: `POST /api/users/bookings/12/cancel`)*

### Success Response (`200 OK`)
```json
{
  "code": 200,
  "message": "Booking cancelled successfully",
  "data": {
    "bookingId": 12,
    "bookingNumber": "BK20261002A1B2C3",
    "bookingStatus": "CANCELLED"
  }
}
```

---

## 7. Service History with `UPCOMING` & `PAST` Tags

Returns user's service history categorized into Upcoming and Past services:

```http
GET /api/users/bookings
```
*(Filter options: `GET /api/users/bookings?type=upcoming` or `GET /api/users/bookings?type=past`)*

### Success Response (`200 OK`)
```json
{
  "code": 200,
  "message": "Service history fetched successfully",
  "data": {
    "upcomingCount": 1,
    "pastCount": 2,
    "upcoming": [
      {
        "bookingId": 12,
        "bookingNumber": "BK20261002A1B2C3",
        "tag": "UPCOMING",
        "bookingStatus": "CONFIRMED",
        "bookingDate": "2026-10-02",
        "bookingTimeSlot": "09:00 AM - 11:00 AM",
        "serviceCenter": {
          "serviceCenterId": 4,
          "name": "Test Service Center",
          "address": "Suncity Avenue 102, Sector 102, Gurugram, Haryana, 122001",
          "serviceCenterImage": "https://storage.example.com/centre.jpg"
        },
        "service": {
          "serviceName": "Bike Service",
          "subServiceName": "PickNDrop",
          "serviceOptionName": "General Service"
        },
        "pricing": {
          "basePrice": 200,
          "deliveryCharge": 200,
          "commissionAmount": 50,
          "discountAmount": 100,
          "finalAmount": 350
        },
        "paymentMode": "PAY_LATER",
        "paymentStatus": "PENDING"
      }
    ],
    "past": [
      {
        "bookingId": 8,
        "bookingNumber": "BK20260915XYZ",
        "tag": "PAST",
        "bookingStatus": "COMPLETED",
        "bookingDate": "2026-09-15",
        "bookingTimeSlot": "11:00 AM - 01:00 PM",
        "serviceCenter": {
          "serviceCenterId": 4,
          "name": "Test Service Center",
          "address": "Suncity Avenue 102, Sector 102, Gurugram, Haryana, 122001",
          "serviceCenterImage": "https://storage.example.com/centre.jpg"
        },
        "service": {
          "serviceName": "Bike Service",
          "subServiceName": "Walk In Service",
          "serviceOptionName": "General Service"
        },
        "pricing": {
          "basePrice": 200,
          "deliveryCharge": 0,
          "commissionAmount": 50,
          "discountAmount": 0,
          "finalAmount": 250
        },
        "paymentMode": "PAY_NOW",
        "paymentStatus": "PAID"
      }
    ]
  }
}
```

---

## 8. Service Partner: Configure Custom Pricing

Service partners can view and set their custom pricing for each service:

### A. Get Service Center Pricing
```http
GET /api/service-partners/service-centres/pricing?serviceCenterId=4&serviceId=2
```

### B. Update Service Center Pricing
```http
PUT /api/service-partners/service-centres/pricing
Content-Type: application/json

{
  "serviceCenterId": 4,
  "serviceId": 2,
  "walkInPrice": 200,
  "pickDropCharge": 200,
  "homeServicePrice": 500,
  "commissionAmount": 50
}
```
