import { api } from '../api.js';
import { showToast } from '../components/toast.js';

export default {
    async render(container) {
        container.innerHTML = `
            <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 class="text-3xl font-bold text-white">Registered Students</h2>
                    <p class="text-gray-400 mt-1">Manage enrolled students, biometric locks, and security controls.</p>
                </div>
                <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <!-- Registration Window Switch -->
                    <div id="reg-status-container" class="flex items-center gap-2 bg-cardbg px-3 py-2 rounded-lg border border-gray-700">
                        <span class="text-xs text-gray-400 font-medium">Registration:</span>
                        <button id="btn-toggle-reg" class="px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors bg-gray-700 text-gray-300">
                            <i class="fas fa-spinner fa-spin"></i> Checking...
                        </button>
                    </div>

                    <div class="relative flex-1 md:w-56">
                        <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                        <input type="text" id="search-student" placeholder="Search name or roll..." class="w-full pl-10 pr-4 py-2 rounded-lg bg-darkbg border border-gray-600 text-white focus:outline-none focus:border-highlight text-sm">
                    </div>
                    <a href="#register" class="bg-highlight hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 font-medium shadow-md text-sm">
                        <i class="fas fa-user-plus"></i> Register
                    </a>
                </div>
            </div>

            <div class="bg-cardbg rounded-xl border border-gray-700 overflow-hidden shadow-lg">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse" id="students-table">
                        <thead>
                            <tr class="text-gray-400 text-xs uppercase bg-gray-800 bg-opacity-50 border-b border-gray-700">
                                <th class="py-4 px-6 font-medium">#</th>
                                <th class="py-4 px-6 font-medium">Name</th>
                                <th class="py-4 px-6 font-medium">Roll Number</th>
                                <th class="py-4 px-6 font-medium">Biometric Lock</th>
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

        // 1. Manage Registration Setting
        const btnToggleReg = document.getElementById('btn-toggle-reg');
        let registrationOpen = true;

        const updateRegBtnUI = (isOpen) => {
            registrationOpen = isOpen;
            if (isOpen) {
                btnToggleReg.className = 'px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30';
                btnToggleReg.innerHTML = '<i class="fas fa-lock-open text-xs"></i> OPEN';
                btnToggleReg.title = 'Click to close registration for all students';
            } else {
                btnToggleReg.className = 'px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30';
                btnToggleReg.innerHTML = '<i class="fas fa-lock text-xs"></i> CLOSED';
                btnToggleReg.title = 'Click to open registration';
            }
        };

        try {
            const settings = await api.getAdminSettings();
            updateRegBtnUI(settings.registration_open);
        } catch (e) {
            btnToggleReg.textContent = 'Unknown';
        }

        btnToggleReg.addEventListener('click', async () => {
            try {
                btnToggleReg.disabled = true;
                const newState = !registrationOpen;
                const res = await api.toggleRegistration(newState);
                updateRegBtnUI(res.registration_open);
                showToast(res.message, "success");
            } catch (err) {
                showToast(`Failed to update setting: ${err.message}`, "error");
            } finally {
                btnToggleReg.disabled = false;
            }
        });

        // 2. Load & Render Students
        try {
            const res = await api.getStudents();
            let students = res.students || res || [];
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
                                <div>
                                    <span class="text-base font-semibold">${s.name}</span>
                                    ${s.created_at ? `<p class="text-xs text-gray-500">Reg: ${s.created_at.slice(0, 10)}</p>` : ''}
                                </div>
                            </div>
                        </td>
                        <td class="py-4 px-6 text-gray-300 font-mono font-medium">${s.roll_no}</td>
                        <td class="py-4 px-6">
                            ${s.is_locked
                                ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30" title="Face profile is securely locked. Proxy/re-registration blocked.">
                                    <i class="fas fa-lock text-xs"></i> Locked
                                   </span>`
                                : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse" title="Face profile is unlocked. Student can update/re-register face.">
                                    <i class="fas fa-lock-open text-xs"></i> Unlocked
                                   </span>`
                            }
                        </td>
                        <td class="py-4 px-6 text-right space-x-2">
                            ${s.is_locked
                                ? `<button data-roll="${s.roll_no}" class="btn-unlock-student text-amber-400 hover:text-white hover:bg-amber-600 px-2.5 py-1.5 border border-amber-500/40 rounded-lg transition-colors text-xs inline-flex items-center gap-1" title="Allow student to update face photo">
                                    <i class="fas fa-key"></i> Reset Face
                                   </button>`
                                : `<button data-roll="${s.roll_no}" class="btn-lock-student text-blue-400 hover:text-white hover:bg-blue-600 px-2.5 py-1.5 border border-blue-500/40 rounded-lg transition-colors text-xs inline-flex items-center gap-1" title="Lock face biometrics">
                                    <i class="fas fa-lock"></i> Lock
                                   </button>`
                            }
                            <a href="#attendance?roll_no=${encodeURIComponent(s.roll_no)}" class="text-highlight hover:text-white px-2.5 py-1.5 border border-highlight hover:bg-highlight rounded-lg transition-colors text-xs inline-flex items-center gap-1">
                                <i class="fas fa-calendar-alt"></i> Attendance
                            </a>
                            <button data-roll="${s.roll_no}" data-name="${s.name}" class="btn-delete-student text-red-400 hover:text-white hover:bg-red-600 px-2.5 py-1.5 border border-red-500/40 rounded-lg transition-colors text-xs inline-flex items-center gap-1">
                                <i class="fas fa-trash-alt"></i> Delete
                            </button>
                        </td>
                    </tr>
                `).join('');

                // Event handlers: Unlock Biometrics
                tbody.querySelectorAll('.btn-unlock-student').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const roll = btn.getAttribute('data-roll');
                        try {
                            btn.disabled = true;
                            const res = await api.unlockStudent(roll);
                            showToast(res.message || `Biometrics unlocked for ${roll}`, "success");
                            const updated = await api.getStudents();
                            students = updated.students || updated || [];
                            renderStudents(students);
                        } catch (err) {
                            showToast(`Failed to unlock: ${err.message}`, "error");
                            btn.disabled = false;
                        }
                    });
                });

                // Event handlers: Lock Biometrics
                tbody.querySelectorAll('.btn-lock-student').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const roll = btn.getAttribute('data-roll');
                        try {
                            btn.disabled = true;
                            const res = await api.lockStudent(roll);
                            showToast(res.message || `Biometrics locked for ${roll}`, "success");
                            const updated = await api.getStudents();
                            students = updated.students || updated || [];
                            renderStudents(students);
                        } catch (err) {
                            showToast(`Failed to lock: ${err.message}`, "error");
                            btn.disabled = false;
                        }
                    });
                });

                // Event handlers: Delete Student
                tbody.querySelectorAll('.btn-delete-student').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const roll = btn.getAttribute('data-roll');
                        const name = btn.getAttribute('data-name');
                        if (!confirm(`Are you sure you want to delete student '${name}' (${roll})? This will also permanently remove their attendance records.`)) {
                            return;
                        }
                        try {
                            await api.deleteStudent(roll);
                            showToast(`Student ${name} deleted successfully.`, "success");
                            const updatedRes = await api.getStudents();
                            students = updatedRes.students || updatedRes || [];
                            renderStudents(students);
                        } catch (err) {
                            showToast(`Failed to delete student: ${err.message}`, "error");
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

