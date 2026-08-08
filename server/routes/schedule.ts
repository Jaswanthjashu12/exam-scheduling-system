import { Router } from 'express';
import { getAllScheduleEntries, createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, bulkReplaceScheduleEntries, clearScheduleEntries, getStudent, getStudentsByCourse } from '../db';
import { ScheduleEntry } from '../../src/types';
import { getInvigilator, getAllInvigilators } from '../db';
import { sendMail } from '../utils/mailer';

const router = Router();

// GET /api/schedule
router.get('/', async (req, res, next) => {
  try {
    const entries = await getAllScheduleEntries();
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

// POST /api/schedule
router.post('/', async (req, res, next) => {
  try {
    const { id, courseId, timeslotId, roomId, invigilatorId } = req.body;
    if (!id || !courseId || !timeslotId || !roomId || !invigilatorId) {
      return res.status(400).json({ error: 'id, courseId, timeslotId, roomId, and invigilatorId are required' });
    }

    const newEntry: ScheduleEntry = { id, courseId, timeslotId, roomId, invigilatorId };
    const created = await createScheduleEntry(newEntry);
    // Send notification email without affecting response if it fails
    try {
      const inv = await getInvigilator(invigilatorId);
      if (inv?.email) {
        await sendMail(inv.email, 'Exam Assignment Notification', `You have been assigned to an exam at ${timeslotId} in room ${roomId}. Please be on time.`);
      }
    } catch (mailErr) {
      console.error('Failed to send assignment email:', mailErr);
    }
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: `Schedule entry with ID already exists` });
    }
    next(err);
  }
});

// PUT /api/schedule/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { courseId, timeslotId, roomId, invigilatorId } = req.body;
    const updated = await updateScheduleEntry(req.params.id, { courseId, timeslotId, roomId, invigilatorId });
    // Notify invigilator of update, ignore errors
    try {
      const inv = await getInvigilator(invigilatorId);
      if (inv?.email) {
        await sendMail(inv.email, 'Exam Assignment Updated', `Your exam assignment has been updated to ${timeslotId} in room ${roomId}. Please be on time.`);
      }
    } catch (mailErr) {
      console.error('Failed to send update email:', mailErr);
    }
    res.json(updated);
  } catch (err: any) {
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/schedule/clear (Note: using DELETE /clear or mounting as subroute)
router.delete('/clear', async (req, res, next) => {
  try {
    await clearScheduleEntries();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// DELETE /api/schedule/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteScheduleEntry(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/schedule/bulk
router.post('/bulk', async (req, res, next) => {
  try {
    const entries = req.body as ScheduleEntry[];
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Body must be an array of schedule entries' });
    }
    const replaced = await bulkReplaceScheduleEntries(entries);
    res.json(replaced);
  } catch (err) {
    next(err);
  }
});

import fs from 'fs';
import path from 'path';

function logToFile(msg: string) {
  const logPath = path.join(process.cwd(), 'data', 'app.log');
  fs.appendFileSync(logPath, new Date().toISOString() + ' ' + msg + '\n');
  console.log(msg);
}

// POST /api/schedule/:id/notify – manually trigger email notification
router.post('/:id/notify', async (req, res, next) => {
  try {
    const entryId = req.params.id;
    logToFile(`[Notify API] Request to notify for entryId: "${entryId}"`);
    // fetch the schedule entry (reuse db function)
    const entries = await getAllScheduleEntries();
    const entry = entries.find(e => e.id === entryId);
    if (!entry) {
      logToFile(`[Notify API] Entry not found in DB. DB has: ${entries.map(e => e.id).join(', ')}`);
      return res.status(404).json({ error: 'Schedule entry not found' });
    }
    logToFile(`[Notify API] Entry found. InvigilatorId: "${entry.invigilatorId}"`);
    if (!entry.invigilatorId) {
      return res.status(400).json({ error: 'No invigilator assigned to this exam. Please assign an invigilator first.' });
    }
    const inv = await getInvigilator(entry.invigilatorId);
    if (!inv) {
      const invigilators = await getAllInvigilators();
      logToFile(`[Notify API] Invigilator "${entry.invigilatorId}" not found in DB! Existing DB invigilators: ${invigilators.map(i => i.id).join(', ')}`);
      return res.status(404).json({ error: 'Assigned invigilator not found in the database.' });
    }
    if (inv.email) {
      const url = await sendMail(inv.email, 'Exam Assignment Notification', `You have been assigned to an exam at ${entry.timeslotId} in room ${entry.roomId}. Please be on time.`);
      if (url) {
        logToFile(`[Notify API] Notification email sent successfully to ${inv.email}`);
        return res.json({ message: 'Notification email sent! A test email was generated.', url });
      }
      logToFile(`[Notify API] Notification email sent successfully to ${inv.email}`);
      return res.json({ message: 'Notification email sent' });
    } else {
      logToFile(`[Notify API] Invigilator ${inv.id} has no email configured`);
      return res.status(400).json({ error: 'Invigilator does not have an email address configured.' });
    }
  } catch (mailErr: any) {
    logToFile(`[Notify API] Failed to send manual notification email: ${mailErr.message}`);
    console.error('Failed to send manual notification email:', mailErr);
    next(mailErr);
  }
});

// POST /api/schedule/send-seating-plan - email seating plan to a proctor
router.post('/send-seating-plan', async (req, res, next) => {
  try {
    const {
      invigilatorId,
      timeslotId,
      roomId,
      timeslotLabel,
      roomLabel,
      seatingGrid,
      riskCount,
      singleExamRoom
    } = req.body;

    if (!invigilatorId || !timeslotId || !roomId || !seatingGrid) {
      return res.status(400).json({ error: 'invigilatorId, timeslotId, roomId, and seatingGrid are required' });
    }

    const inv = await getInvigilator(invigilatorId);
    if (!inv) {
      return res.status(404).json({ error: 'Invigilator not found' });
    }

    if (!inv.email) {
      return res.status(400).json({ error: 'Invigilator does not have an email address configured.' });
    }

    // Identify max rows and columns for table rendering
    let maxRow = 1;
    let maxCol = 1;
    for (const seat of seatingGrid) {
      if (seat.row > maxRow) maxRow = seat.row;
      if (seat.col > maxCol) maxCol = seat.col;
    }

    // Build the grid HTML table
    let tableHtml = `<table style="width: 100%; border-collapse: separate; border-spacing: 8px; font-family: sans-serif; margin-bottom: 20px;">`;
    
    // Front Stage Desk Platform
    tableHtml += `
      <tr>
        <td colspan="${maxCol}" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; text-align: center; padding: 10px; font-size: 11px; font-weight: bold; border-radius: 6px; letter-spacing: 1.5px;">
          🏫 EXAMINER DESK / PROCTOR PLATFORM
        </td>
      </tr>
    `;

    for (let r = 1; r <= maxRow; r++) {
      tableHtml += `<tr>`;
      for (let c = 1; c <= maxCol; c++) {
        const seat = seatingGrid.find((s: any) => s.row === r && s.col === c);
        if (seat && seat.student) {
          const isRisk = seat.isRisk && !singleExamRoom;
          const bg = isRisk ? '#fdf2f2' : '#ffffff';
          const border = isRisk ? '#fca5a5' : '#e2e8f0';
          const titleColor = isRisk ? '#991b1b' : '#0f172a';
          const idColor = isRisk ? '#b91c1c' : '#64748b';
          const badgeBg = isRisk ? '#fee2e2' : '#f0f9ff';
          const badgeBorder = isRisk ? '#fca5a5' : '#e0f2fe';
          const badgeText = isRisk ? '#991b1b' : '#0369a1';
          
          const accList = seat.student.accommodations || [];
          const accIcons = accList.includes('accessible') ? '♿' : (accList.length > 0 ? '⏱️' : '');

          tableHtml += `
            <td style="background-color: ${bg}; border: 1px solid ${border}; padding: 12px 8px; text-align: center; border-radius: 8px; width: ${100/maxCol}%; font-size: 11px; vertical-align: top; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
              <div style="font-size: 9px; color: #94a3b8; font-family: monospace; margin-bottom: 4px;">Row ${r}-${c} ${accIcons}</div>
              <div style="font-weight: bold; color: ${titleColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${seat.student.name}">
                ${seat.student.name}
              </div>
              <div style="font-family: monospace; font-size: 10px; color: ${idColor}; margin: 2px 0;">
                ID: ${seat.student.id}
              </div>
              <div style="display: inline-block; background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeText}; font-weight: bold; font-family: monospace; font-size: 9px; padding: 2px 4px; border-radius: 4px; margin-top: 4px;">
                ${seat.course?.id || ''}
              </div>
              ${isRisk ? '<div style="color: #ef4444; font-size: 9px; font-weight: bold; margin-top: 4px;">⚠️ Proximity Risk</div>' : ''}
            </td>
          `;
        } else {
          tableHtml += `
            <td style="background-color: #f8fafc; border: 1px dashed #e2e8f0; padding: 12px 8px; text-align: center; border-radius: 8px; width: ${100/maxCol}%; font-size: 11px; vertical-align: middle; color: #94a3b8;">
              <div style="font-size: 9px; color: #cbd5e1; font-family: monospace; margin-bottom: 4px;">Row ${r}-${c}</div>
              Empty Seat
            </td>
          `;
        }
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</table>`;

    // Anti-Cheat Analysis
    let risksHtml = '';
    if (riskCount > 0 && !singleExamRoom) {
      const riskSeats = seatingGrid.filter((s: any) => s.isRisk && s.student);
      risksHtml = `
        <div style="background-color: #fdf2f2; border: 1px solid #f87171; color: #991b1b; padding: 16px; border-radius: 10px; margin-bottom: 25px; font-family: sans-serif;">
          <h4 style="margin-top: 0; margin-bottom: 8px; font-size: 14px; font-weight: bold;">⚠️ Anti-Cheat Proximity Warnings (${riskCount})</h4>
          <p style="margin: 0; font-size: 12px; line-height: 1.5;">
            The scheduling engine detected same-year candidates seated horizontally adjacent to each other. Please review these placements to prevent potential integrity violations:
          </p>
          <ul style="margin: 10px 0 0 20px; padding: 0; font-size: 12px; line-height: 1.6;">
      `;
      for (const seat of riskSeats) {
        risksHtml += `<li>Seat <strong>Row ${seat.row}, Col ${seat.col}</strong>: <strong>${seat.student.name}</strong> (${seat.student.id}) taking <strong>${seat.course?.id}</strong> is adjacent to another student in the same academic year.</li>`;
      }
      risksHtml += `
          </ul>
        </div>
      `;
    } else if (singleExamRoom) {
      risksHtml = `
        <div style="background-color: #eff6ff; border: 1px solid #93c5fd; color: #1e40af; padding: 14px; border-radius: 10px; margin-bottom: 25px; font-family: sans-serif; font-size: 12px; line-height: 1.5;">
          <strong>ℹ️ Single-Year Room</strong><br/>
          This room is exclusively assigned to candidates of a single academic year. Since all candidates in the room belong to the same year, horizontal adjacency is expected and normal. No cheating proximity alerts are flagged.
        </div>
      `;
    } else {
      risksHtml = `
        <div style="background-color: #f0fdf4; border: 1px solid #86efac; color: #166534; padding: 14px; border-radius: 10px; margin-bottom: 25px; font-family: sans-serif; font-size: 12px; line-height: 1.5;">
          <strong>✓ Proximity Audit Passed</strong><br/>
          Success! The classroom layout complies with the cheating-prevention rule (no same-year candidates are seated side-by-side horizontally).
        </div>
      `;
    }

    // Candidate Roster
    let candidatesListHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: sans-serif; font-size: 12px; text-align: left;">
        <thead>
          <tr style="border-bottom: 2px solid #e2e8f0; color: #475569;">
            <th style="padding: 10px 6px;">Candidate Name</th>
            <th style="padding: 10px 6px;">ID</th>
            <th style="padding: 10px 6px;">Exam / Course</th>
            <th style="padding: 10px 6px;">Seat Location</th>
            <th style="padding: 10px 6px;">Accommodations</th>
          </tr>
        </thead>
        <tbody>
    `;

    const activeSeats = seatingGrid.filter((s: any) => s.student).sort((a: any, b: any) => {
      return (a.student.name || '').localeCompare(b.student.name || '');
    });

    for (const seat of activeSeats) {
      const seatLabel = `Row ${seat.row}, Col ${seat.col}`;
      const branchText = seat.course?.branch ? ` (${seat.course.branch})` : '';
      const accoms = seat.student.accommodations || [];
      const accomsStr = accoms.length > 0
        ? `<span style="background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; border: 1px solid #fde68a;">⚠️ ${accoms.join(', ')}</span>`
        : '<span style="color: #94a3b8;">None</span>';

      candidatesListHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9; color: #334155;">
          <td style="padding: 10px 6px; font-weight: bold; color: #0f172a;">${seat.student.name}</td>
          <td style="padding: 10px 6px; font-family: monospace;">${seat.student.id}</td>
          <td style="padding: 10px 6px;">${seat.course?.id || ''}${branchText}</td>
          <td style="padding: 10px 6px; font-weight: 500; color: #4f46e5;">${seatLabel}</td>
          <td style="padding: 10px 6px;">${accomsStr}</td>
        </tr>
      `;
    }
    candidatesListHtml += `
        </tbody>
      </table>
    `;

    const emailSubject = `Exam Seating Arrangement: ${timeslotLabel} in ${roomLabel}`;
    
    const emailBody = `
      <div style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; max-width: 750px; margin: 20px auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 20px; font-weight: 800;">Examination Seating & Desks Audit</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Automated Proctor Briefing Notification</p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          Dear <strong>${inv.name}</strong>,
        </p>

        <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
          You have been scheduled as the lead proctor for the session below. We have automatically resolved a desk map based on candidates' roll numbers and department branches. Please review this layout below. If you notice any spacing conflicts or mistakes, you can coordinate desks when students report.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 10px; margin-bottom: 25px;">
          <h4 style="margin: 0 0 12px 0; color: #334155; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px;">Session Logistics Summary</h4>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569; width: 140px;">Timeslot:</td>
              <td style="padding: 4px 0; color: #0f172a;">${timeslotLabel}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569;">Room:</td>
              <td style="padding: 4px 0; color: #0f172a;">${roomLabel}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569;">Assigned Proctor:</td>
              <td style="padding: 4px 0; color: #0f172a;"><strong>${inv.name}</strong> (${inv.email || 'None'})</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569;">Scheduled Count:</td>
              <td style="padding: 4px 0; color: #0f172a;">${activeSeats.length} candidates</td>
            </tr>
          </table>
        </div>

        ${risksHtml}

        <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 25px; margin-bottom: 15px; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
          🖥️ Desks Grid Map Matrix
        </h3>
        
        <div style="overflow-x: auto; margin-bottom: 25px; border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; background-color: #fafafa;">
          ${tableHtml}
        </div>

        <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 30px; margin-bottom: 15px; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
          📋 Candidate Roll & Roster
        </h3>
        
        ${candidatesListHtml}

        <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 15px; text-align: center; color: #94a3b8; font-size: 11px;">
          This is an automated administrative broadcast. If you notice any conflicts or errors, contact the examinations coordinator.
        </div>
      </div>
    `;

    logToFile(`[Seating Plan Email] Sending seating plan to invigilator "${inv.name}" <${inv.email}>`);
    const url = await sendMail(inv.email, emailSubject, emailBody);
    
    if (url) {
      logToFile(`[Seating Plan Email] Ethereal preview created: ${url}`);
      return res.json({ message: 'Seating plan emailed successfully!', url });
    }
    return res.json({ message: 'Seating plan emailed successfully!' });

  } catch (err: any) {
    logToFile(`[Seating Plan Email] Failed to send email: ${err.message}`);
    console.error('Failed to send seating plan email:', err);
    next(err);
  }
});

// POST /api/schedule/send-student-seat-notifications
// Emails every seated student their personal seat assignment
router.post('/send-student-seat-notifications', async (req, res, next) => {
  try {
    const {
      timeslotLabel,
      roomLabel,
      collegeName,
      seatingGrid,
      singleExamRoom
    } = req.body;

    if (!seatingGrid || !Array.isArray(seatingGrid)) {
      return res.status(400).json({ error: 'seatingGrid array is required' });
    }

    // Seats that have a student with an email
    const occupiedSeats = seatingGrid.filter((s: any) => s.student?.id && s.student?.email);

    if (occupiedSeats.length === 0) {
      return res.status(400).json({ error: 'No students with email addresses found in this seating grid. Please add email addresses to students in the Configuration tab.' });
    }

    logToFile(`[Student Notify] Sending seat notifications to ${occupiedSeats.length} students for ${timeslotLabel} in ${roomLabel}`);

    const results: { studentId: string; email: string; status: 'sent' | 'failed'; url?: string }[] = [];
    let firstUrl: string | undefined;

    for (const seat of occupiedSeats) {
      const { student, course, row, col } = seat as any;
      const seatLabel = `Row ${row}, Seat ${col}`;
      const courseText = course ? `${course.id}${course.name ? ` – ${course.name}` : ''}` : 'Your Exam';
      const accoms: string[] = student.accommodations || [];
      const accomsBadge = accoms.length > 0
        ? `<div style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;border-radius:6px;padding:8px 12px;font-size:12px;margin-top:12px;">⚠️ <strong>Special Accommodations:</strong> ${accoms.join(', ')}</div>`
        : '';

      const emailHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;color:#1e293b;max-width:600px;margin:20px auto;padding:0;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 30px 22px;">
            <div style="font-size:11px;color:#c4b5fd;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:6px;">🎓 ${collegeName || 'Examination Board'}</div>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.2;">Exam Seat Assignment</h1>
            <p style="margin:6px 0 0;font-size:13px;color:#e0e7ff;">Your official seating confirmation for the upcoming examination</p>
          </div>

          <!-- Body -->
          <div style="padding:28px 30px;background:#ffffff;">
            <p style="font-size:14px;line-height:1.7;color:#334155;margin-top:0;">Dear <strong>${student.name}</strong>,</p>
            <p style="font-size:13px;line-height:1.7;color:#64748b;">Your seat for the upcoming examination has been confirmed. Please report to your assigned seat 15 minutes before the exam begins. Carry a valid ID card along with your admit card.</p>

            <!-- Info Card -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:20px 0;">
              <div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">Exam Details</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;width:130px;">Student Name</td>
                  <td style="padding:6px 0;color:#0f172a;font-weight:700;">${student.name}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;">Student ID</td>
                  <td style="padding:6px 0;font-family:monospace;color:#4f46e5;font-weight:700;">${student.id}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;">Exam / Course</td>
                  <td style="padding:6px 0;color:#0f172a;font-weight:600;">${courseText}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;">Date &amp; Time</td>
                  <td style="padding:6px 0;color:#0f172a;font-weight:600;">${timeslotLabel}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;">Venue</td>
                  <td style="padding:6px 0;color:#0f172a;font-weight:600;">${roomLabel}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;">Seat Number</td>
                  <td style="padding:6px 0;">
                    <span style="background:#4f46e5;color:#fff;font-weight:800;padding:4px 12px;border-radius:6px;font-size:13px;letter-spacing:0.5px;">${seatLabel}</span>
                  </td>
                </tr>
              </table>
              ${accomsBadge}
            </div>

            <!-- Instructions -->
            <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;padding:14px 18px;font-size:12px;line-height:1.7;color:#1e40af;margin-bottom:20px;">
              <strong>📋 Important Instructions:</strong><br/>
              • Arrive at least <strong>15 minutes</strong> before the scheduled start time.<br/>
              • Bring a valid <strong>photo ID</strong> and your <strong>admit card</strong>.<br/>
              • Electronic devices are <strong>strictly prohibited</strong> inside the examination hall.<br/>
              • Refer to your assigned seat number on the classroom door chart.
            </div>

            <p style="font-size:13px;color:#64748b;line-height:1.6;">If you believe there is an error with your seat assignment, please contact the Examinations Coordinator immediately.</p>
          </div>

          <!-- Footer -->
          <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 30px;text-align:center;font-size:11px;color:#94a3b8;">
            This is an automated notification from the Examination Management System. Do not reply to this email.
          </div>
        </div>
      `;

      try {
        const url = await sendMail(student.email, `Exam Seat Confirmation – ${courseText} | ${timeslotLabel}`, emailHtml);
        results.push({ studentId: student.id, email: student.email, status: 'sent', url: url as string | undefined });
        if (!firstUrl && url) firstUrl = url as string;
        logToFile(`[Student Notify] ✅ Sent to ${student.name} <${student.email}> — ${seatLabel}`);
      } catch (mailErr: any) {
        logToFile(`[Student Notify] ❌ Failed for ${student.name} <${student.email}>: ${mailErr.message}`);
        results.push({ studentId: student.id, email: student.email, status: 'failed' });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return res.json({
      message: `Sent ${sentCount} seat notification email${sentCount !== 1 ? 's' : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
      sentCount,
      failedCount,
      results,
      ...(firstUrl ? { url: firstUrl } : {})
    });

  } catch (err: any) {
    logToFile(`[Student Notify] Fatal error: ${err.message}`);
    console.error('Failed to send student seat notifications:', err);
    next(err);
  }
});


// POST /api/schedule/notify-exam-assignment
// Emails all enrolled students of a course that their exam has been assigned a date/room.
router.post('/notify-exam-assignment', async (req, res, next) => {
  try {
    const {
      courseId,
      courseName,
      timeslotLabel,
      roomLabel,
      collegeName,
    } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // Fetch students enrolled in this course who have an email
    const rows = await getStudentsByCourse(courseId);

    if (rows.length === 0) {
      return res.status(200).json({
        message: 'No students with email addresses are enrolled in this course.',
        sentCount: 0,
        failedCount: 0,
        results: []
      });
    }

    logToFile(`[Exam Assignment Notify] Sending exam assignment emails to ${rows.length} students for course "${courseId}"`);

    const results: { studentId: string; email: string; status: 'sent' | 'failed'; url?: string }[] = [];
    let firstUrl: string | undefined;

    for (const student of rows) {
      const emailHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;color:#1e293b;max-width:600px;margin:20px auto;padding:0;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 30px 22px;">
            <div style="font-size:11px;color:#c4b5fd;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:6px;">🎓 ${collegeName || 'Examination Board'}</div>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.2;">Exam Scheduled</h1>
            <p style="margin:6px 0 0;font-size:13px;color:#e0e7ff;">Your examination has been officially assigned a date and venue.</p>
          </div>

          <!-- Body -->
          <div style="padding:28px 30px;background:#ffffff;">
            <p style="font-size:14px;line-height:1.7;color:#334155;margin-top:0;">Dear <strong>${student.name}</strong>,</p>
            <p style="font-size:13px;line-height:1.7;color:#64748b;">We are writing to inform you that an examination has been scheduled for you. Please review the details below and make sure you are well prepared.</p>

            <!-- Info Card -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:20px 0;">
              <div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">Examination Details</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;width:140px;">Student Name</td>
                  <td style="padding:6px 0;color:#0f172a;font-weight:700;">${student.name}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;">Student ID</td>
                  <td style="padding:6px 0;font-family:monospace;color:#4f46e5;font-weight:700;">${student.id}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;">Course</td>
                  <td style="padding:6px 0;color:#0f172a;font-weight:600;">${courseName ? `${courseId} – ${courseName}` : courseId}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;">Scheduled Date &amp; Time</td>
                  <td style="padding:6px 0;color:#0f172a;font-weight:600;">${timeslotLabel || 'To be announced'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-weight:600;">Venue</td>
                  <td style="padding:6px 0;color:#0f172a;font-weight:600;">${roomLabel || 'To be announced'}</td>
                </tr>
              </table>
            </div>

            <!-- Status Badge -->
            <div style="text-align:center;margin:20px 0;">
              <span style="display:inline-block;background:#dcfce7;border:1px solid #86efac;color:#166534;font-weight:800;padding:8px 20px;border-radius:999px;font-size:13px;letter-spacing:0.5px;">
                ✅ Exam Officially Assigned
              </span>
            </div>

            <!-- Instructions -->
            <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;padding:14px 18px;font-size:12px;line-height:1.7;color:#1e40af;margin-bottom:20px;">
              <strong>📋 Important Instructions:</strong><br/>
              • Note the exam date and time carefully.<br/>
              • Your seat number will be communicated separately once the seating arrangement is finalized.<br/>
              • Bring a valid <strong>photo ID</strong> and your <strong>admit card</strong> on the day of the exam.<br/>
              • Electronic devices are <strong>strictly prohibited</strong> inside the examination hall.
            </div>

            <p style="font-size:13px;color:#64748b;line-height:1.6;">If you believe you have received this email in error, or have questions about your exam schedule, please contact the Examinations Coordinator immediately.</p>
          </div>

          <!-- Footer -->
          <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 30px;text-align:center;font-size:11px;color:#94a3b8;">
            This is an automated notification from the Examination Management System. Do not reply to this email.
          </div>
        </div>
      `;

      try {
        const url = await sendMail(student.email, `Exam Scheduled: ${courseName || courseId} | ${timeslotLabel || ''}`, emailHtml);
        results.push({ studentId: student.id, email: student.email, status: 'sent', url: url as string | undefined });
        if (!firstUrl && url) firstUrl = url as string;
        logToFile(`[Exam Assignment Notify] ✅ Sent to ${student.name} <${student.email}>`);
      } catch (mailErr: any) {
        logToFile(`[Exam Assignment Notify] ❌ Failed for ${student.name} <${student.email}>: ${mailErr.message}`);
        results.push({ studentId: student.id, email: student.email, status: 'failed' });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return res.json({
      message: `Exam assignment notification sent to ${sentCount} student${sentCount !== 1 ? 's' : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
      sentCount,
      failedCount,
      results,
      ...(firstUrl ? { url: firstUrl } : {})
    });

  } catch (err: any) {
    logToFile(`[Exam Assignment Notify] Fatal error: ${err.message}`);
    console.error('Failed to send exam assignment notifications:', err);
    next(err);
  }
});

export default router;
