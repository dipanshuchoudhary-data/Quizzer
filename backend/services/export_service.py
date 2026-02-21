import io,csv
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models.result import Result
from backend.models.attempt import Attempt
from backend.models.student_profile import StudentProfile

## 1. Fetch result data
 
async def fetch_results_for_quiz(db:AsyncSession,quiz_id:str):
    query = (
        select(Result,Attempt,StudentProfile)
        .join(Attempt,Result.attempt_id==Attempt.id)
        .join(StudentProfile,StudentProfile.attempt_id==Attempt.id)
        .where(Attempt.quiz_id==quiz_id)
    )

    result = await db.execute(query)
    rows = result.all()
    structured=[]

    for result_odj,attempt,profile in rows:
        structured.append(
            
            {

            "student_name":profile.student_name,
            "enrollment_number": profile.enrollment_number,
            "final_score":result_odj.final_score,
            "violation_count":result_odj.violation_count,
            "integrity_flag":result_odj.integrity_flag,
            "status":result_odj.status,
            "submitted_at":attempt.submitted_at,
            }
        )
    return structured      

## CSV result generator

def generate_csv(data:list[dict]) -> bytes:
    output = io.StringIO()
    writer = csv.DictWriter(output,fieldnames=data[0].keys())

    writer.writeheader()
    writer.writerows(data)

    return output.getvalue().encode("utf-8")


## EXCEL generator

def generate_excel(data:list[dict]) -> bytes:
    wb = Workbook()
    ws = wb.active

    headers = list(data[0].keys())
    ws.append(headers)

    for row in data:
        ws.append(list(row.values()))
    
    stream = io.BytesIO()
    wb.save(stream)

    return stream.getvalue()

