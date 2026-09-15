import { api } from '../api.js';

export default {
    async render(container, queryParams = '') {
        const params = new URLSearchParams(queryParams);
        const preselectRoll = params.get('roll_no') || '';

        container.innerHTML = `
            <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 class="text-3xl font-bold text-white">Attendance Records</h2>
                    <p class="text-gray-400 mt-1">Search, filter, and export verified attendance logs.</p>
                </div>
                <button id="btn-export" class="bg-cardbg border border-gray-600 hover:border-green-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                    <i class="fas fa-file-csv text-green-400"></i> Export CSV
                </button>
            </div>

            <!-- Filters -->
            <div class="bg-cardbg rounded-xl border border-gray-700 p-4 mb-6 flex flex-wrap gap-4 items-end shadow-md">
                <div class="flex-1 min-w-[200px]">
                    <label class="block text-xs font-medium text-gray-400 mb-1">Filter by Student</label>
                    <select id="filter-student" class="w-full px-3 py-2 rounded-lg bg-darkbg border border-gray-600 text-white focus:outline-none focus:border-highlight">
                        <option value="">All Students</option>
                    </select>
                </div>
                <div class="flex-1 min-w-[150px]">
                    <label class="block text-xs font-medium text-gray-400 mb-1">Filter by Date</label>
                    <input type="date" id="filter-date" class="w-full px-3 py-2 rounded-lg bg-darkbg border border-gray-600 text-white focus:outline-none focus:border-highlight">
                </div>
                <div class="flex gap-2">
                    <button id="btn-filter" class="bg-highlight hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium h-[42px] transition-colors flex items-center gap-2">
                        <i class="fas fa-filter"></i> Apply Filter
                    </button>
                    <button id="btn-reset-filter" class="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg font-medium h-[42px] transition-colors">
                        Reset
                    </button>
                </div>
            </div>

            <!-- Table -->
            <div class="bg-cardbg rounded-xl border border-gray-700 overflow-hidden shadow-lg">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse" id="attendance-table">
                        <thead>
                            <tr class="text-gray-400 text-sm uppercase bg-gray-800 bg-opacity-50 border-b border-gray-700">
                                <th class="py-4 px-6 font-medium">Date</th>
                                <th class="py-4 px-6 font-medium">Time</th>
                                <th class="py-4 px-6 font-medium">Student Name</th>
                                <th class="py-4 px-6 font-medium">Roll Number</th>
                                <th class="py-4 px-6 font-medium">Method</th>
                                <th class="py-4 px-6 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody id="attendance-body" class="text-sm">
                            <tr><td colspan="6" class="py-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading records...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        let currentRecords = [];

        try {
            const studentsRes = await api.getStudents().catch(() => ({ students: [] }));
            const students = studentsRes.students || studentsRes || [];
            const studentSelect = document.getElementById('filter-student');
            
            if (Array.isArray(students)) {
                students.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s.roll_no;
                    option.textContent = `${s.name} (${s.roll_no})`;
                    if (preselectRoll && s.roll_no === preselectRoll) {
                        option.selected = true;
                    }
                    studentSelect.appendChild(option);
                });
            }

            const loadRecords = async () => {
                const tbody = document.getElementById('attendance-body');
                tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading records...</td></tr>`;
                
                try {
                    const rollNo = document.getElementById('filter-student').value;
                    const date = document.getElementById('filter-date').value;
                    
                    const res = await api.getAttendance(rollNo, date);
                    const records = res.records || res || [];
                    currentRecords = Array.isArray(records) ? records : [];
                    
                    if (currentRecords.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-500">No attendance records found for this filter.</td></tr>`;
                        return;
                    }

                    tbody.innerHTML = currentRecords.map(r => `
                        <tr class="border-b border-gray-700 hover:bg-gray-800 transition-colors">
                            <td class="py-4 px-6 text-gray-300 font-mono">${r.date}</td>
                            <td class="py-4 px-6 text-gray-300 font-mono">${r.time}</td>
                            <td class="py-4 px-6 font-medium text-white">${r.name || '-'}</td>
                            <td class="py-4 px-6 text-gray-300 font-mono">${r.roll_no}</td>
                            <td class="py-4 px-6 text-gray-400">
                                <span class="bg-gray-700 px-2.5 py-1 rounded text-xs font-mono inline-flex items-center gap-1">
                                    <i class="fas fa-camera text-highlight"></i> Face
                                </span>
                            </td>
                            <td class="py-4 px-6">
                                <span class="badge ${r.status === 'Present' ? 'badge-present' : 'badge-absent'}">${r.status || 'Present'}</span>
                            </td>
                        </tr>
                    `).join('');
                } catch (e) {
                    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-400">Error loading records: ${e.message}</td></tr>`;
                }
            };

            document.getElementById('btn-filter').addEventListener('click', loadRecords);
            document.getElementById('btn-reset-filter').addEventListener('click', () => {
                document.getElementById('filter-student').value = '';
                document.getElementById('filter-date').value = '';
                loadRecords();
            });

            // CSV Export
            document.getElementById('btn-export').addEventListener('click', () => {
                if (currentRecords.length === 0) {
                    alert("No records to export.");
                    return;
                }
                const csvHeader = "Date,Time,Name,Roll No,Status\n";
                const csvRows = currentRecords.map(r => 
                    `"${r.date}","${r.time}","${(r.name || '').replace(/"/g, '""')}","${r.roll_no}","${r.status || 'Present'}"`
                ).join("\n");
                
                const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Attendance_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            });

            loadRecords();

        } catch (error) {
            console.error("Attendance page error:", error);
        }
    }
};

