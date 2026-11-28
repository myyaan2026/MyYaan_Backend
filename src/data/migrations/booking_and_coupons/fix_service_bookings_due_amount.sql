-- Fix due_amount for all existing unpaid bookings where due_amount is 0 or null
UPDATE service_bookings
SET due_amount = GREATEST(0, final_amount - COALESCE(paid_amount, 0))
WHERE payment_status <> 'PAID';
