import { api } from '../api.js';

export default {
    async render(container) {
        const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const todayIso = new Date().toISOString().slice(0, 10);
        
        let stats = { totalStudents: 0, presentToday: 0, activeClassrooms: 0, health: 'Offline' };
        let recent = [];
        
        try {
            const [studentsRes, healthRes, attendanceRes, timetableRes] = await Promise.allSettled([
                api.getStudents(),
                api.healthCheck(),
                api.getAttendance(),
                api.getTimetable()
            ]);

            if (studentsRes.status === 'fulfilled') {
                const studentsList = studentsRes.value.students || studentsRes.value || [];
                stats.totalStudents = Array.isArray(studentsList) ? studentsList.length : 0;
            }

            if (healthRes.status === 'fulfilled' && healthRes.value.status === 'healthy') {
                stats.health = 'Online';
            }

            if (timetableRes.status === 'fulfilled' && timetableRes.value.current_slot?.class) {
                stats.activeClassrooms = 1;
            }

            if (attendanceRes.status === 'fulfilled') {
                const records = attendanceRes.value.records || attendanceRes.value || [];
                if (Array.isArray(records)) {
                    const todayRecords = records.filter(r => r.date === todayIso);
                    const uniquePresentToday = new Set(todayRecords.map(r => r.roll_no));
                    stats.presentToday = uniquePresentToday.size;
                    recent = records.slice(0, 6);
                }
            }
        } catch (e) {
            console.error("Error fetching stats", e);
        }

        container.innerHTML = `
            <div class="mb-8 flex justify-between items-end">
                <div>
                    <h2 class="text-3xl font-bold text-white mb-2">Dashboard</h2>
                    <p class="text-gray-400">${dateStr}</p>
                </div>
                <button id="refresh-dashboard" class="bg-cardbg border border-gray-600 hover:border-highlight text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-cardbg rounded-xl p-6 border border-gray-700 hover-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Total Students</p>
                            <h3 class="text-2xl font-bold text-white">${stats.totalStudents}</h3>
                        </div>
                        <div class="w-12 h-12 bg-accent rounded-full flex items-center justify-center text-highlight text-xl">
                            <i class="fas fa-users"></i>
                        </div>
                    </div>
                </div>
                
                <div class="bg-cardbg rounded-xl p-6 border border-gray-700 hover-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Present Today</p>
                            <h3 class="text-2xl font-bold text-white">${stats.presentToday}</h3>
                        </div>
                        <div class="w-12 h-12 bg-green-900 bg-opacity-50 rounded-full flex items-center justify-center text-green-400 text-xl">
                            <i class="fas fa-user-check"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-cardbg rounded-xl p-6 border border-gray-700 hover-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Active Classrooms</p>
                            <h3 class="text-2xl font-bold text-white">${stats.activeClassrooms}</h3>
                        </div>
                        <div class="w-12 h-12 bg-blue-900 bg-opacity-50 rounded-full flex items-center justify-center text-blue-400 text-xl">
                            <i class="fas fa-door-open"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-cardbg rounded-xl p-6 border border-gray-700 hover-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">System Health</p>
                            <h3 class="text-2xl font-bold ${stats.health === 'Online' ? 'text-green-400' : 'text-red-400'}">${stats.health}</h3>
                        </div>
                        <div class="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-300 text-xl">
                            <i class="fas fa-server"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="bg-cardbg rounded-xl border border-gray-700 overflow-hidden shadow-lg">
                <div class="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 bg-opacity-50">
                    <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                        <i class="fas fa-history text-highlight"></i> Recent Attendance Logs
                    </h3>
                    <a href="#attendance" class="text-xs text-highlight hover:underline">View All &rarr;</a>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="text-gray-400 text-sm uppercase bg-cardbg border-b border-gray-700">
                                <th class="py-3 px-6 font-medium">Date & Time</th>
                                <th class="py-3 px-6 font-medium">Student Name</th>
                                <th class="py-3 px-6 font-medium">Roll No</th>
                                <th class="py-3 px-6 font-medium">Method</th>
                                <th class="py-3 px-6 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm">
                            ${recent.length > 0 ? recent.map(r => `
                                <tr class="border-b border-gray-700 hover:bg-gray-800 transition-colors">
                                    <td class="py-3 px-6 text-gray-300 font-mono">${r.date} ${r.time}</td>
                                    <td class="py-3 px-6 text-white font-medium">${r.name || '-'}</td>
                                    <td class="py-3 px-6 text-gray-300 font-mono">${r.roll_no}</td>
                                    <td class="py-3 px-6 text-gray-300">
                                        <span class="bg-gray-700 px-2 py-1 rounded text-xs font-mono">
                                            <i class="fas fa-camera mr-1 text-highlight"></i> Face
                                        </span>
                                    </td>
                                    <td class="py-3 px-6">
                                        <span class="badge ${r.status === 'Present' ? 'badge-present' : 'badge-absent'}">${r.status || 'Present'}</span>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="5" class="py-8 text-center text-gray-500">No recent activity found. Marked attendances will appear here.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('refresh-dashboard').addEventListener('click', () => {
            this.render(container);
        });

        // Auto refresh setup
        const interval = setInterval(() => this.render(container), 20000);
        if(window.currentIntervals) window.currentIntervals.push(interval);
    }
};
