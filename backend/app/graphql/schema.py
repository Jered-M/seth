import strawberry
from typing import List, Optional
from app.models.security_models import Department, Device

@strawberry.type
class UserType:
    id: str
    name: str
    email: str
    role: str

@strawberry.type
class EquipmentType:
    id: str
    type: str
    status: str
    serialNumber: str
    location: Optional[str]

@strawberry.type
class DepartmentType:
    id: str
    name: str
    
    @strawberry.field
    def equipments(self) -> List[EquipmentType]:
        items = Device.query.filter_by(department_id=self.id).all()
        return [EquipmentType(
            id=i.id,
            type=i.name or 'OTHER',
            status=i.status,
            serialNumber=i.serial_number,
            location=None
        ) for i in items]

@strawberry.type
class Query:
    @strawberry.field
    def departments(self) -> List[DepartmentType]:
        deps = Department.query.all()
        return [DepartmentType(id=d.id, name=d.name) for d in deps]
    
    @strawberry.field
    def equipments(self, status: Optional[str] = None) -> List[EquipmentType]:
        query = Device.query
        if status:
            query = query.filter_by(status=status)
        items = query.all()

        return [EquipmentType(
            id=i.id,
            type=i.name or 'OTHER',
            status=i.status,
            serialNumber=i.serial_number,
            location=None
        ) for i in items]

schema = strawberry.Schema(query=Query)
