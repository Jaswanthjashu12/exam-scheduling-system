import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initDatabase } from "./server/db";
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
