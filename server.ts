import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initDatabase, db, getAllScheduleEntries, getEmailLogs, logEmail, registerUser, getUserByUsername, getAllUsers } from "./server/db";
import { buildConstraints } from "./server/services/constraintBuilder";
import { validateProposal } from "./server/services/aiValidator";
import coursesRouter from "./server/routes/courses";
import roomsRouter from "./server/routes/rooms";
import studentsRouter from "./server/routes/students";
import invigilatorsRouter from "./server/routes/invigilators";
import scheduleRouter from "./server/routes/schedule";
import branchesRouter from "./server/routes/branches";
import collegeRouter from "./server/routes/college";
import optimizerRouter from "./server/routes/optimizer";
import importRouter from "./server/routes/import";


let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  // Initialize Firebase Database
  try {
    await initDatabase();
    console.log('[Database] Database initialized and seeded successfully');
  } catch (err: any) {
    console.error('[Database] Failed to initialize database:', err.message);
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Mount REST API routers
  app.use("/api/courses", coursesRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/invigilators", invigilatorsRouter);
  app.use("/api/schedule", scheduleRouter);
  app.use("/api/branches", branchesRouter);
  app.use("/api/college", collegeRouter);
  app.use("/api/optimizer", optimizerRouter);
  app.use("/api/import", importRouter);

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Authentication endpoints
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, collegeName, adminCode } = req.body;
      if (!username || !password || !collegeName) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (adminCode !== "ADMIN2026") {
        return res.status(400).json({ error: "Invalid admin registration key" });
      }
      const existing = await getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: "Username already registered" });
      }
      await registerUser(username, password, collegeName);
      res.json({ success: true, message: "User registered successfully" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Missing username or password" });
      }
      const user = await getUserByUsername(username);
      if (!user) {
        return res.status(400).json({ error: "No account found with this username" });
      }
      if (user.password !== password) {
        return res.status(400).json({ error: "Incorrect password" });
      }
      res.json({ success: true, username: user.username, collegeName: user.collegeName });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/auth/users", async (req, res) => {
    try {
      const usersList = await getAllUsers();
      res.json(usersList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Database Export Endpoint
  app.get("/api/db/download", (req, res) => {
    try {
      const dbPath = path.resolve(process.cwd(), "data", "exam_scheduler.db");
      if (fs.existsSync(dbPath)) {
        res.setHeader("Content-Disposition", "attachment; filename=exam_scheduler.db");
        res.download(dbPath, "exam_scheduler.db");
      } else {
        res.status(404).json({ error: "Database file not found" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Lazy Gemini API wrapper to suggest optimizations based on current schedules and conflicts
  app.post("/api/gemini/optimize-feedback", async (req, res) => {
    try {
      const { schedule, conflicts, stats } = req.body;
      
      let client: GoogleGenAI;
      try {
        client = getGeminiClient();
      } catch (keyErr: any) {
        return res.status(200).json({
          feedback: `### 💡 Optimization Insight (Preview Mode)
          
Your Gemini API key is not configured yet. Set up **GEMINI_API_KEY** in **Settings > Secrets** to unlock AI-powered timetable audits!

**General Quick Recommendations:**
1. **Balance Rooms**: Try moving exams from high-demand buildings to smaller alternative sections.
2. **Invigilator Fatigue**: Set a solid daily cap (e.g. max 2 assignment duties) to improve fairness.
3. **Cheating Isolation**: Buffer courses with similar content into separate rows or subsequent slots rather than side-by-side seating.`
        });
      }

      const prompt = `
You are an expert academic scheduling consultant. Analyze this examination schedule state, its conflicts, and resource stats, and provide 3-4 actionable, high-quality optimization suggestions for the administrator.

---
### INPUT DATA STATE
- Room Utilization: ${JSON.stringify(stats?.roomUtilization || "Unknown")}%
- Accommodation Compliance: ${stats?.accommodationCompliance || "100"}%
- Unassigned Invigilators: ${stats?.unassignedInvigilators || 0}
- Current Conflicts detected: ${JSON.stringify(conflicts || [])}
- Active Exams scheduled: ${schedule?.length || 0} exams.

Sample schedule entries: ${JSON.stringify((schedule || []).slice(0, 8))}
---

Provide a beautifully formatted Markdown response with:
1. **Overview Score**: Brief evaluation of the current schedule's health.
2. **Specific Action Points**: Bulleted, highly precise recommendations (e.g., "Shift Exam X because of Conflict Y", "Re-utilize Room Z in Building W").
3. **Smart Accommodation Compliance advice**.
4. **Cheating Risk Mitigation advice**.

Keep the tone supportive, professional, and clear. Avoid engineering jargon, focus on scheduling fairness & logistics. Do not include blocky code snippets, make it easily readable.
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ feedback: response.text });
    } catch (err: any) {
      console.error("Gemini API Feedback Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate AI feedback" });
    }
  });

  // Gemini API route to generate an custom-themed dataset
  app.post("/api/gemini/generate-mock-data", async (req, res) => {
    try {
      const { theme } = req.body; // e.g., "Medical School", "Cybersecurity High", "Arts & Drama Academy"
      
      let client: GoogleGenAI;
      try {
        client = getGeminiClient();
      } catch (keyErr: any) {
        // Return structured fallback data
        return res.status(200).json({
          isFallback: true,
          theme: theme || "General University",
          courses: [
            { id: "CS-101", name: "Introduction to Computer Science", duration: 120, priority: "High" },
            { id: "MATH-201", name: "Linear Algebra & Calculus", duration: 180, priority: "Medium" },
            { id: "PHY-302", name: "Quantum Mechanics", duration: 120, priority: "High" },
            { id: "BIO-105", name: "Biological Sciences", duration: 90, priority: "Low" },
            { id: "CHEM-202", name: "Organic Chemistry II", duration: 120, priority: "Medium" }
          ],
          rooms: [
            { id: "R-101", name: "Main Auditorium", capacity: 80, building: "Main Hall", accessible: true },
            { id: "R-102", name: "Science Lab room", capacity: 30, building: "Science Tower", accessible: false },
            { id: "R-103", name: "Seminary Wing 1A", capacity: 15, building: "West Annex", accessible: true }
          ],
          invigilators: [
            { id: "INV-01", name: "Dr. Rachel Green", department: "Science", availability: ["Day 1 Morning", "Day 1 Afternoon", "Day 2 Morning"], maxWorkload: 3 },
            { id: "INV-02", name: "Prof. Alan Turing", department: "Computing", availability: ["Day 1 Afternoon", "Day 2 Morning", "Day 2 Afternoon"], maxWorkload: 4 },
            { id: "INV-03", name: "Dr. Rosalind Franklin", department: "Chemistry", availability: ["Day 1 Morning", "Day 2 Afternoon"], maxWorkload: 2 }
          ],
          students: [
            { id: "STU-01", name: "Alice Smith", courses: ["CS-101", "MATH-201"], accommodations: [] },
            { id: "STU-02", name: "Bob Johnson", courses: ["MATH-201", "PHY-302"], accommodations: ["extra_time"] },
            { id: "STU-03", name: "Charlie Adams", courses: ["CS-101", "PHY-302"], accommodations: ["separate_room", "accessible"] },
            { id: "STU-04", name: "Diana Prince", courses: ["BIO-105", "CHEM-202"], accommodations: [] },
            { id: "STU-05", name: "Ethan Hunt", courses: ["CS-101", "CHEM-202"], accommodations: [] },
            { id: "STU-06", name: "Fiona Gallagher", courses: ["BIO-105", "MATH-201"], accommodations: ["scribe"] }
          ]
        });
      }

      const prompt = `
Generate a structured JSON configuration for an examination scheduling database themed around the institution type: "${theme}".
Return EXACTLY a JSON object without markdown wrapper backticks. The JSON should parse cleanly in JavaScript.

The object MUST contain:
1. "theme": Same as input theme.
2. "courses": Array of 5 unique courses. Each course must have "id" (string), "name" (string, themed), "duration" (number in minutes, e.g. 90, 120, 150, 180), "priority" ("High" | "Medium" | "Low").
3. "rooms": Array of 4 unique exam rooms. Each room must have "id" (string), "name" (string), "capacity" (integer, e.g. 15, 30, 60, 100), "building" (string, e.g., "Tesla Pavilion", "Plato Arch"), "accessible" (boolean).
4. "invigilators": Array of 5 invigilators. ID format "INV-XX", "name" (string, themed academic name), "department" (string), "availability" (array of timeslots e.g. ["Day 1 Morning", "Day 1 Afternoon", "Day 2 Morning", "Day 2 Afternoon"]), "maxWorkload" (integer between 2 and 4).
5. "students": Array of 12 detailed student records. Each student must have "id" (string, format "STU-XX"), "name" (string), "courses" (array of 1 to 3 course IDs from your courses list), "accommodations" (array containing strings from: "extra_time", "separate_room", "accessible", "scribe"). Make sure at least 2 or 3 students have accommodation requirements.

Generate a highly detailed, coherent, and fun themed dataset. Return ONLY the raw JSON block without markdown formatting or backticks.
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "{}";
      // Sanitize the response text in case Gemini wraps it in standard markdown backticks
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.substring(7);
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.substring(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      }
      
      const parsedData = JSON.parse(cleanJson.trim());
      res.json(parsedData);
    } catch (err: any) {
      console.error("Gemini Generate Mock Data Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate themed mock data" });
    }
  });

  // Stage 1: Generate AI proposal without modifying SQLite
  app.post("/api/ai/auto-fix", async (req, res) => {
    try {
      const constraints = await buildConstraints();

      // If no conflicts detected, return early
      if (!constraints.conflicts || constraints.conflicts.length === 0) {
        return res.status(200).json({
          success: true,
          validated: true,
          proposal: { modifications: [] },
          errors: [],
          conflicts: [],
          remainingConflicts: [],
          message: "No scheduling conflicts detected. Your timetable is already fully compliant!"
        });
      }

      let client: GoogleGenAI;
      try {
        client = getGeminiClient();
      } catch (keyErr: any) {
        // Fallback / Preview Mode: simulate resolving one conflict
        const mockModifications = [];
        
        const originalHardCount = constraints.conflicts.filter(c => c.type === "Hard").length;
        if (originalHardCount > 0) {
          const firstConflict = constraints.conflicts.find(c => c.type === "Hard") || constraints.conflicts[0];
          const parts = firstConflict.id.split("_");
          
          let entryToFix = null;

          // Try to match by conflict ID parts
          if (firstConflict.id.startsWith("room_") && parts.length >= 3) {
            const timeslotId = parts[1];
            const roomId = parts[2];
            entryToFix = constraints.exams.find(e => e.timeslotId === timeslotId && e.roomId === roomId);
          } else if (firstConflict.id.startsWith("stu_") && parts.length >= 4) {
            const timeslotId = parts[2];
            const courseId = parts[3];
            entryToFix = constraints.exams.find(e => e.timeslotId === timeslotId && e.courseId === courseId);
          } else if (firstConflict.id.startsWith("invig_") && parts.length >= 3) {
            const timeslotId = parts[1];
            const invigId = parts[2];
            entryToFix = constraints.exams.find(e => e.timeslotId === timeslotId && e.invigilatorId.includes(invigId));
          }

          // Fallback: search by message contents
          if (!entryToFix) {
            entryToFix = constraints.exams.find(e => 
              firstConflict.message.includes(e.courseId) || 
              (e.timeslotId && firstConflict.message.includes(e.timeslotId)) ||
              (e.invigilatorId && firstConflict.message.includes(e.invigilatorId))
            );
          }

          // If still not found, pick the first exam entry
          if (!entryToFix) {
            entryToFix = constraints.exams.find(e => e.timeslotId);
          }

          if (entryToFix) {
            const otherSlot = entryToFix.timeslotId.endsWith("Morning") 
              ? entryToFix.timeslotId.replace("Morning", "Afternoon") 
              : entryToFix.timeslotId.endsWith("Afternoon")
                ? entryToFix.timeslotId.replace("Afternoon", "Evening")
                : entryToFix.timeslotId.replace("Evening", "Morning");
            const finalSlot = otherSlot || "Day-1-Morning";

            mockModifications.push({
              entryId: entryToFix.id,
              timeslotId: finalSlot,
              roomId: entryToFix.roomId,
              invigilatorId: entryToFix.invigilatorId,
              reason: `Shifted timeslot from [${entryToFix.timeslotId}] to [${finalSlot}] to resolve clash: ${firstConflict.category}`
            });
          }
        }

        const val = await validateProposal(mockModifications);
        return res.status(200).json({
          success: true,
          validated: val.valid,
          proposal: { modifications: mockModifications },
          errors: val.errors,
          conflicts: constraints.conflicts,
          remainingConflicts: val.newConflicts,
          message: "Your Gemini API key is not configured. Running in Fallback Preview Mode with simulated resolution."
        });
      }

      const prompt = `
You are an examination scheduling constraint solver.
You are given the current scheduling resources and a list of detected conflicts.
Your task is to propose the smallest set of valid changes required to resolve the conflicts.

---
### SCHEDULING RESOURCES & CONSTRAINTS
Exams (entries): ${JSON.stringify(constraints.exams)}
Rooms: ${JSON.stringify(constraints.rooms)}
Accommodated Students: ${JSON.stringify(constraints.accommodatedStudents)}
Proctors: ${JSON.stringify(constraints.proctors)}

### DETECTED CONFLICTS TO RESOLVE
${JSON.stringify(constraints.conflicts)}
---

Propose modifications to timeslotId, roomId, or invigilatorId for specific entries.
You MUST return ONLY a structured JSON object containing:
- "modifications": An array of proposed modifications. Each object in this array must contain:
  - "entryId": The ID of the schedule entry to modify (must match one of the current entry IDs).
  - "timeslotId": The proposed new timeslot ID OR keep it same.
  - "roomId": The proposed new room ID OR keep it same.
  - "invigilatorId": The proposed new invigilator ID (or comma separated list) OR keep it same.
  - "reason": A brief explanation of why this modification resolves the conflict.
- "resolvedConflicts": Array of conflict IDs/names resolved.
- "remainingConflicts": Array of conflict IDs/names that could not be resolved.

Rules:
- Suggest only valid existing IDs.
- Follow all room capacity and proctor availability constraints.
- If a conflict cannot be resolved, leave it in remainingConflicts.
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              modifications: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    entryId: { type: "STRING" },
                    timeslotId: { type: "STRING", nullable: true },
                    roomId: { type: "STRING", nullable: true },
                    invigilatorId: { type: "STRING", nullable: true },
                    reason: { type: "STRING" }
                  },
                  required: ["entryId", "reason"]
                }
              },
              resolvedConflicts: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              remainingConflicts: {
                type: "ARRAY",
                items: { type: "STRING" }
              }
            },
            required: ["modifications", "resolvedConflicts", "remainingConflicts"]
          }
        }
      });

      const responseText = response.text || "{}";
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.substring(7);
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.substring(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      }

      let parsedData;
      try {
        parsedData = JSON.parse(cleanJson.trim());
      } catch (parseErr: any) {
        console.error("Gemini output JSON parsing failed:", parseErr, "Raw output:", responseText);
        return res.json({
          success: false,
          validated: false,
          proposal: { modifications: [] },
          errors: [`AI output parsing failed: ${parseErr.message || parseErr}. The model generated invalid JSON format. Please try again.`],
          conflicts: constraints.conflicts,
          remainingConflicts: constraints.conflicts
        });
      }
      const modifications = parsedData.modifications || [];

      // Validate proposal against actual current database rules
      const val = await validateProposal(modifications);

      res.json({
        success: val.valid,
        validated: true,
        proposal: { modifications },
        errors: val.errors,
        conflicts: constraints.conflicts,
        remainingConflicts: val.newConflicts
      });
    } catch (err: any) {
      console.error("Gemini Auto-Fix Proposal Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate AI auto-fix solutions" });
    }
  });

  // Keep old endpoint mapping as a proxy to prevent any client-side breaks
  app.post("/api/gemini/auto-fix", async (req, res, next) => {
    // Redirect to the new proposal endpoint, but apply immediately for old client compatibility if needed
    // Actually, we'll let it call the auto-fix proposal directly
    req.url = "/api/ai/auto-fix";
    next();
  });

  // Stage 2: Apply the proposal inside a transaction
  app.post("/api/ai/apply-fix", async (req, res) => {
    try {
      const { modifications } = req.body;
      if (!modifications || !Array.isArray(modifications)) {
        return res.status(400).json({ error: "Missing or invalid modifications array." });
      }

      // Re-read current database state and re-validate changes to detect stale checks
      const val = await validateProposal(modifications);
      if (!val.valid) {
        return res.status(422).json({
          success: false,
          error: "Validation failed: Stale or invalid proposal.",
          errors: val.errors
        });
      }

      // Perform updates inside a strict SQLite transaction block
      const updateStmt = db.prepare('UPDATE schedule_entries SET timeslot_id = COALESCE(?, timeslot_id), room_id = COALESCE(?, room_id), invigilator_id = COALESCE(?, invigilator_id) WHERE id = ?');
      
      try {
        db.transaction(() => {
          for (const mod of modifications) {
            updateStmt.run(mod.timeslotId, mod.roomId, mod.invigilatorId, mod.entryId);
          }
        })();
      } catch (txErr: any) {
        console.error("Apply AI Fix Transaction Failed:", txErr);
        return res.status(500).json({
          success: false,
          error: `Database transaction failed: ${txErr.message}. All modifications rolled back.`
        });
      }

      // Audit Log into email_logs table
      const auditSummary = `Applied ${modifications.length} modifications to resolve schedule conflicts.`;
      const auditDetails = JSON.stringify({
        modifications,
        timestamp: new Date().toISOString(),
        originalConflictsCount: val.originalConflictsCount,
        remainingConflictsCount: val.newConflictsCount
      }, null, 2);

      await logEmail(
        "SYSTEM",
        "AI Auto-Fix Resolution Applied",
        auditDetails,
        "Applied",
        "https://ethereal.email/message/ai-auto-fix-applied"
      );

      const updatedEntries = await getAllScheduleEntries();
      res.json({
        success: true,
        message: "AI Auto-Fix applied successfully and committed to database.",
        entries: updatedEntries
      });
    } catch (err: any) {
      console.error("Apply AI Fix Error:", err);
      res.status(500).json({ error: err.message || "Failed to commit AI Auto-Fix changes" });
    }
  });

  // API endpoint to retrieve email logs
  app.get("/api/emails/logs", async (req, res, next) => {
    try {
      const logs = await getEmailLogs();
      res.json(logs);
    } catch (err) {
      next(err);
    }
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Server Error:", err);
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
  });
}

startServer();
