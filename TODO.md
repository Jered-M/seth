# GPS Location & Department Fix Plan

Current working directory: c:/Users/HP/Documents/site/seth

## Completed (0/7)

- [ ] 1. Verify/create /admin/departments endpoint in backend/app/routes/admin.py
- [x] 2. Extend backend/app/seeds.py: Add test Devices per department with GPS coords (lastKnownLat/Lng)
- [x] 3. Fix frontend/src/services/equipmentService.ts: Map backend fields (last_known_lat -> lat)
- [ ] 4. Fix frontend/src/hooks/useEquipments.ts: Consistent mapping
- [ ] 5. Update frontend/src/pages/TrackingMap.tsx: Use correct fields, add manual GPS update
- [x] 6. Fix frontend/src/pages/DepartmentEquipmentMap.tsx: Field names (last_known_lat -> latitude)

- [ ] 7. Fix frontend/src/pages/AdminDepartments.tsx: Handle endpoint response
- [ ] 8. Test: Run backend/test_endpoints.py
- [ ] 9. Verify frontend maps show dept/GPS data

## Next Step

Start with backend seeds.py to add GPS test data, then endpoints.

**Legend:** DB seeded (depts/users exist per seed.py output). Backend running on :5000. Frontend Vite needs API_URL update?
