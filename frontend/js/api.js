const API_BASE_URL = window.location.port === "8000" ? "" : "http://localhost:8000";

async function fetchWithHandler(url, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${url}`, options);
        if (!response.ok) {
            let errorText = await response.text();
            try {
                const parsed = JSON.parse(errorText);
                if (parsed.detail) errorText = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
            } catch (_) {}
            throw new Error(errorText || `API Error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("API Request Failed:", error);
        throw error;
    }
}

export const api = {
    // Health Check
    healthCheck: () => fetchWithHandler("/health"),

    // Student & Verification
    registerStudent: (formData) => fetchWithHandler("/register", {
        method: "POST",
        body: formData
    }),
    verifyFace: (formData) => fetchWithHandler("/verify", {
        method: "POST",
        body: formData
    }),
    getStudents: () => fetchWithHandler("/students"),
    deleteStudent: (rollNo) => fetchWithHandler(`/students/${encodeURIComponent(rollNo)}`, {
        method: "DELETE"
    }),

    // Attendance Records
    getAttendance: (rollNo = '', date = '') => {
        let query = [];
        if (rollNo) query.push(`roll_no=${encodeURIComponent(rollNo)}`);
        if (date) query.push(`date_filter=${encodeURIComponent(date)}`);
        const qs = query.length ? `?${query.join('&')}` : '';
        return fetchWithHandler(`/attendance${qs}`);
    },

    // Timetable & Strict 10-Min Window Management
    getTimetable: () => fetchWithHandler("/timetable"),
    addTimetableEntry: (formData) => fetchWithHandler("/timetable", {
        method: "POST",
        body: formData
    }),
    deleteTimetableEntry: (id) => fetchWithHandler(`/timetable/${id}`, {
        method: "DELETE"
    }),
    endClass: (formData) => fetchWithHandler("/end_class", {
        method: "POST",
        body: formData
    })
};
