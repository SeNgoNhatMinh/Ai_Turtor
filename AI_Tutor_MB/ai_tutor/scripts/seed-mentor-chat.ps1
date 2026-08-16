# Seed / fix dữ liệu mentor để flow escalation → live chat hoạt động.
# Chạy: powershell -ExecutionPolicy Bypass -File scripts/seed-mentor-chat.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$js = Join-Path $root "seed-mentor-chat.js"

Write-Host "`n==> Copy seed script into MongoDB container" -ForegroundColor Cyan
docker cp $js ai-tutor-mongodb:/tmp/seed-mentor-chat.js
docker exec ai-tutor-mongodb mongosh tutor_db --quiet /tmp/seed-mentor-chat.js

Write-Host "`n==> Restart API (sync mentor login accounts)" -ForegroundColor Cyan
docker restart ai-tutor-api | Out-Null
Start-Sleep -Seconds 8

Write-Host "`n==> Verify offer API" -ForegroundColor Cyan
$login = Invoke-RestMethod -Uri "http://localhost:8085/api/users/login" -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"danvhtse180108@fpt.edu.vn","password":"09112004"}'
$escId = docker exec ai-tutor-mongodb mongosh tutor_db --quiet --eval `
    "db.question_escalations.find().sort({createdAt:-1}).limit(1).forEach(e=>print(e._id))"
if ($escId) {
    $offer = Invoke-RestMethod -Uri "http://localhost:8085/api/tutor/escalations/offer?questionEscalationId=$escId" `
        -Method POST -Headers @{ Authorization = "Bearer $($login.token)" }
    Write-Host "  suggested mentors: $(@($offer.suggestedMentors).Count)" -ForegroundColor Green
    foreach ($m in $offer.suggestedMentors) {
        Write-Host "  - $($m.mentorName) ($($m.id))"
    }
}

Write-Host "`n=== MENTOR SEED COMPLETE ===" -ForegroundColor Green
Write-Host "Teacher login: teacher.a@school.local / 0900000000"
Write-Host "Student login: danvhtse180108@fpt.edu.vn / 09112004"
Write-Host "Gõ Telex: oo=ô, aw=ă, dd=đ | Ví dụ: Noojp bafi treer = Nộp bài trễ"
