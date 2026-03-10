// backend/server.js

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config(); // Loads variables from .env file

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("FATAL ERROR: GEMINI_API_KEY is not defined in your .env file.");
  process.exit(1); // Exit the application if the key is not set
}

const modelName = "gemini-1.5-flash-preview-0514";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

// --- LOCAL KNOWLEDGE BASE ---
const KNOWLEDGE_BASE = {
  name: "Buddha Institute of Technology (BIT), Gorakhpur",
  location: "CL-1, Sector 7, GIDA, Gorakhpur, Uttar Pradesh 273209, India.",
  affiliation: "Approved by AICTE, New Delhi & Affiliated to Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow.",
  contact: "Phone: +91 9554559900 | +91 9839621881. Email: director@bit.ac.in",
  key_leadership: "The institute is currently led by Dr. Roop Ranjan (Director), ensuring academic excellence and operational efficiency.",
  courses_ug: [
    "B.Tech (Computer Science & Engineering, Artificial Intelligence & Machine Learning, Electronics & Communication Engineering, Civil Engineering, Mechanical Engineering, Information Technology, Data Science)",
    "B.Tech Lateral Entry",
    "Bachelor of Vocational Studies (B.Voc)",
    "BBA, BCA, BCom, B-Pharma, D-Pharma, Hotel Management, BA-LLB, LLB",
  ],
  courses_pg: [
    "M.Tech (Computer Science Engineering, Electronics & Communication Engineering)",
  ],
  courses_diploma: [
    "Polytechnic Diploma in (Mechanical Engineering, Civil Engineering, Computer Science, Electrical Engineering, Electronics Engineering)",
    "D.Pharm",
  ],
  admission_btech: "Admission to B.Tech is primarily entrance-based, requiring a valid score in JEE Main followed by UPTAC counselling.",
  admission_mtech: "Admission to M.Tech is entrance-based, requiring a valid score in CUET PG followed by UPTAC counselling.",
  admission_diploma: "Admission to Diploma (Polytechnic/D.Pharm) is through the JEECUP examination and subsequent counselling.",
  scholarship_schemes: "BIT facilitates multiple scholarship schemes, including those provided by the UP Government (SC/ST/OBC/General categories) based on income and merit, as well as internal merit-based scholarships for top-performing students.",
  placement_summary: "The Training and Placement Cell at BIT is highly active, focusing on grooming students for industry roles. The institute consistently records strong placement rates across all branches.",
  placement_companies: "Top recruiters often include TCS, Wipro, Infosys, Tech Mahindra, HCL, and various regional IT and core engineering firms.",
  placement_records: "For the 2023-2024 academic year, the highest package recorded was INR 15 LPA (Achieved in CSE/IT), and the average package was INR 3.25 LPA.",
  syllabus_note: "The syllabus is governed by the affiliating body, Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow. It follows the standard semester system and is updated periodically to meet industry demands.",
  training_cell: "The Training & Placement (T&P) Cell organizes technical workshops, soft skill training, mock interviews, and industrial visits throughout the year to ensure students are industry-ready.",
  campus_area: "The BIT Gorakhpur campus spans a sprawling 10+ acres, providing a vast and green environment for holistic learning and development.",
  campus_facilities: "Key campus facilities include modern academic blocks, separate hostels for boys and girls, a central library, well-equipped labs, high-speed Wi-Fi, sports grounds, and an on-campus cafeteria.",
  campus_environment: "The campus is designed to be a serene and stimulating learning environment, fostering innovation and co-curricular activities.",
  college_events: "Major annual events include the grand Buddha Sharad Mahotsav (12 october- 14 october), Abhivyakti (Cultural Fest), Tech-Nix (Technical Fest), and various sports tournaments. Departmental seminars and guest lectures are held frequently.",
};

// --- HARDCODED ANSWER LOGIC ---
function getHardcodedAnswer(query) {
    const lowerQuery = query.toLowerCase();
    // This is the full function you provided, moved to the server
    if (lowerQuery.includes("location") || lowerQuery.includes("address")) {
        return `The ${KNOWLEDGE_BASE.name} is located at: ${KNOWLEDGE_BASE.location}.\n\nIt is affiliated with ${KNOWLEDGE_BASE.affiliation}.`;
    }
    if (lowerQuery.includes("contact") || lowerQuery.includes("phone")) {
        return `You can contact the Buddha Institute of Technology (BIT), Gorakhpur using the following details:\n\n- Phone: ${KNOWLEDGE_BASE.contact.split("|")[0].trim()}\n- Email: ${KNOWLEDGE_BASE.contact.split("|")[1].trim().replace("Email:", "")}`;
    }
    if (lowerQuery.includes("courses") || lowerQuery.includes("programs")) {
        let response = "The Buddha Institute of Technology offers courses across various levels:\n\n";
        response += "Undergraduate (UG) / Vocational:\n- " + KNOWLEDGE_BASE.courses_ug.join("\n- ") + "\n\n";
        response += "Postgraduate (PG):\n- " + KNOWLEDGE_BASE.courses_pg.join("\n- ") + "\n\n";
        response += "Diploma / Polytechnic:\n- " + KNOWLEDGE_BASE.courses_diploma.join("\n- ");
        return response;
    }
    if (lowerQuery.includes("placement") || lowerQuery.includes("package")) {
        let response = "Here is the placement and training information available locally:\n\n";
        response += `Summary: ${KNOWLEDGE_BASE.placement_summary}\n\n`;
        response += `Latest Records: ${KNOWLEDGE_BASE.placement_records}\n\n`;
        response += `Recruiters: ${KNOWLEDGE_BASE.placement_companies}\n\n`;
        response += `Training: ${KNOWLEDGE_BASE.training_cell}`;
        return response;
    }
    // Add any other `if` conditions from your original function here...
    return null; // No hardcoded answer found
}

const systemPrompt = `You are the helpful and knowledgeable official AI Assistant for the Buddha Institute of Technology (BIT) in Gorakhpur, Uttar Pradesh, India. Your primary goal is to provide accurate, up-to-date, and polite answers regarding the college's programs, admissions, location, and key features. Always base your response on the search results provided. Maintain a professional and encouraging tone appropriate for assisting prospective and current students. If the search fails or no data is returned, you MUST politely state that the information cannot be found online at the moment.`;

// --- THE API ENDPOINT ---
app.post('/api/ask', async (req, res) => {
    const { question, history } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question is required.' });
    }

    // 1. Check local knowledge base first
    const hardcodedAnswer = getHardcodedAnswer(question);
    if (hardcodedAnswer) {
        console.log("Serving a hardcoded answer.");
        return res.json({ answer: hardcodedAnswer });
    }

    // 2. If no local answer, call Gemini API
    console.log("No hardcoded answer found, calling Gemini API...");
    try {
        const payload = {
            contents: [...history, { role: "user", parts: [{ text: question }] }],
            tools: [{ google_search: {} }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        const response = await axios.post(GEMINI_API_URL, payload);
        const candidate = response.data.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            return res.json({ answer: text });
        } else {
            return res.status(500).json({ answer: "I'm sorry, I couldn't get a valid response. Please try again." });
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error.response ? error.response.data : error.message);
        return res.status(500).json({ answer: 'My apologies, I am having trouble connecting to the online search. I can only answer questions about topics in my local knowledge base right now.' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});