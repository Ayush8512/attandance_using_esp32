import { api } from '../api.js';

export default {
    async render(container) {
        container.innerHTML = `
            <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 class="text-3xl font-bold text-white">Registered Students</h2>
                    <p class="text-gray-400 mt-1">Manage enrolled students and face recognition profiles.</p>
                </div>
                <div class="flex w-full md:w-auto gap-3">
                    <div class="relative w-full md:w-64">
                        <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                        <input type="text" id="search-student" placeholder="Search by name or roll..." class="w-full pl-10 pr-4 py-2 rounded-lg bg-darkbg border border-gray-600 text-white focus:outline-none focus:border-highlight">
                    </div>
                    <a href="#register" class="bg-highlight hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 font-medium shadow-md">
                        <i class="fas fa-user-plus"></i> Register
                    </a>
                </div>
            </div>

            <div class="bg-cardbg rounded-xl border border-gray-700 overflow-hidden shadow-lg">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse" id="students-table">
                        <thead>
                            <tr class="text-gray-400 text-sm uppercase bg-gray-800 bg-opacity-50 border-b border-gray-700">
                                <th class="py-4 px-6 font-medium">#</th>
                                <th class="py-4 px-6 font-medium">Name</th>
                                <th class="py-4 px-6 font-medium">Roll Number</th>
                                <th class="py-4 px-6 font-medium">Face Profile</th>
                                <th class="py-4 px-6 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="students-body" class="text-sm">
                            <tr><td colspan="5" class="py-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading students...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        try {
            const res = await api.getStudents();
            const students = res.students || res || [];
            const tbody = document.getElementById('students-body');
            
            const renderStudents = (data) => {
                if (!Array.isArray(data) || data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-gray-500">No registered students found. Click "Register" to add.</td></tr>`;
                    return;
                }
                
                tbody.innerHTML = data.map((s, index) => `
                    <tr class="border-b border-gray-700 hover:bg-gray-800 transition-colors group">
                        <td class="py-4 px-6 text-gray-400 font-mono">${index + 1}</td>
                        <td class="py-4 px-6 font-medium text-white">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-white shadow">
                                    ${s.name ? s.name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <span class="text-base">${s.name}</span>
                            </div>
                        </td>
                        <td class="py-4 px-6 text-gray-300 font-mono font-medium">${s.roll_no}</td>
                        <td class="py-4 px-6">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                <i class="fas fa-check-circle text-xs"></i> Enrolled
                            </span>
                        </td>
                        <td class="py-4 px-6 text-right space-x-2">
                            <a href="#attendance?roll_no=${encodeURIComponent(s.roll_no)}" class="text-highlight hover:text-white px-3 py-1.5 border border-highlight hover:bg-highlight rounded-lg transition-colors text-xs inline-flex items-center gap-1">
                                <i class="fas fa-calendar-alt"></i> Attendance
                            </a>
                            <button data-roll="${s.roll_no}" data-name="${s.name}" class="btn-delete-student text-red-400 hover:text-white hover:bg-red-600 px-2.5 py-1.5 border border-red-500/40 rounded-lg transition-colors text-xs inline-flex items-center gap-1">
                                <i class="fas fa-trash-alt"></i> Delete
                            </button>
                        </td>
                    </tr>
                `).join('');

                tbody.querySelectorAll('.btn-delete-student').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const roll = btn.getAttribute('data-roll');
                        const name = btn.getAttribute('data-name');
                        if (!confirm(`Are you sure you want to delete student '${name}' (${roll})? This will also remove their attendance records.`)) {
                            return;
                        }
                        try {
                            await api.deleteStudent(roll);
                            const updatedRes = await api.getStudents();
                            renderStudents(updatedRes.students || updatedRes || []);
                        } catch (err) {
                            alert(`Failed to delete student: ${err.message}`);
                        }
                    });
                });
            };

            renderStudents(students);

            document.getElementById('search-student').addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = students.filter(s => 
                    (s.name && s.name.toLowerCase().includes(term)) || 
                    (s.roll_no && s.roll_no.toLowerCase().includes(term))
                );
                renderStudents(filtered);
            });

        } catch (error) {
            document.getElementById('students-body').innerHTML = `
                <tr><td colspan="5" class="py-8 text-center text-red-400">Failed to load students: ${error.message}</td></tr>
            `;
        }
    }
};

