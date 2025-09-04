// Firebase imports (v12 modules)
        import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
        import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";
        import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
        import {
            getFirestore, collection, addDoc, getDocs, getDoc, doc,
            query, where, orderBy, serverTimestamp, limit
        } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

        // Your Firebase config (from your project amjad-attendance-6)
        const firebaseConfig = {
            apiKey: "AIzaSyCRKlsEn4KhSmcIvo2N_YH9SDXjYS6DGi0",
            authDomain: "amjad-attendance-6.firebaseapp.com",
            projectId: "amjad-attendance-6",
            storageBucket: "amjad-attendance-6.firebasestorage.app",
            messagingSenderId: "820031615244",
            appId: "1:820031615244:web:c38056902e3bd8b2e91929",
            measurementId: "G-0Z15NYG3DL"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        try { getAnalytics(app); } catch(e) { /* analytics may require https */ }
        const auth = getAuth(app);
        const db = getFirestore(app);

        // ===== Helpers =====
        function yyyymmddLocal(date = new Date()) {
            const tzoffset = date.getTimezoneOffset() * 60000;
            const localISO = new Date(date - tzoffset).toISOString().slice(0, 10);
            return localISO;
        }

        function showToast(message, type = 'success') {
            const toastContainer = document.querySelector('.toast-container');
            const toastId = 'toast-' + Date.now();
            const toast = document.createElement('div');
            toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            toast.id = toastId;
            
            toast.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            `;
            
            toastContainer.appendChild(toast);
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
            
            toast.addEventListener('hidden.bs.toast', () => {
                toast.remove();
            });
        }

        // Role selection pills
        const roleOptions = document.querySelectorAll('.role-option');
        roleOptions.forEach(option => {
            option.addEventListener('click', function() {
                roleOptions.forEach(o => o.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // ===== Auth & Login =====
        const loginForm = document.getElementById('loginForm');
        const loginButton = document.getElementById('loginButton');
        const loginText = loginButton.querySelector('.login-text');
        const loginSpinner = loginButton.querySelector('.spinner-border-sm');
        const loginError = document.getElementById('loginError');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = (document.getElementById('username').value || '').trim();
            const password = document.getElementById('password').value;
            const selectedRole = document.querySelector('.role-option.active').getAttribute('data-role');

            if (!email || !password) return;

            loginText.style.display = 'none';
            loginSpinner.style.display = 'inline-block';
            loginError.style.display = 'none';

            try {
                await signInWithEmailAndPassword(auth, email, password);
                // Show app
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('appScreen').style.display = 'block';
                document.getElementById('dashboardRole').textContent = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);
                showToast('Login successful!');
                await loadAllData();
            } catch (error) {
                console.error('Login error:', error);
                loginError.textContent = error.message;
                loginError.style.display = 'block';
            } finally {
                loginText.style.display = 'inline-block';
                loginSpinner.style.display = 'none';
            }
        });

        // Keep UI if already logged in
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('appScreen').style.display = 'block';
                await loadAllData();
            } else {
                document.getElementById('loginScreen').style.display = 'block';
                document.getElementById('appScreen').style.display = 'none';
            }
        });

        // ===== Firestore Data Loaders =====
        async function loadAllData() {
            await Promise.all([
                loadCountsAndTodayAttendance(),
                populatePeopleOptions(),
                loadRecentActivity()
            ]);
        }

        async function loadCountsAndTodayAttendance() {
            try {
                const [studentsSnap, teachersSnap] = await Promise.all([
                    getDocs(collection(db, 'students')),
                    getDocs(collection(db, 'teachers'))
                ]);

                // Counts
                const totalStudents = studentsSnap.size;
                const totalTeachers = teachersSnap.size;
                document.getElementById('totalStudents').textContent = totalStudents;
                document.getElementById('totalTeachers').textContent = totalTeachers;

                // Today's attendance
                const today = yyyymmddLocal();
                const attendanceQ = query(
                    collection(db, 'attendance'),
                    where('date', '==', today),
                    orderBy('timestamp', 'desc')
                );
                const attendanceSnap = await getDocs(attendanceQ);

                let presentCount = 0;
                let lateCount = 0;
                const tbody = document.getElementById('attendanceTableBody');
                tbody.innerHTML = '';

                attendanceSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    const status = data.status || 'absent';
                    if (status === 'present') presentCount++;
                    if (status === 'late') lateCount++;

                    const badgeClass = status === 'present' ? 'badge-present' : status === 'late' ? 'badge-late' : 'badge-absent';

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${data.name || '-'}</td>
                        <td>${data.role || '-'}</td>
                        <td>${data.time || '-'}</td>
                        <td><span class="badge ${badgeClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" title="Edit (not implemented)">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                const totalPeople = totalStudents + totalTeachers;
                const attendanceRate = totalPeople > 0 ? Math.round((presentCount / totalPeople) * 100) : 0;
                document.getElementById('attendanceRate').textContent = `${attendanceRate}%`;
                document.getElementById('lateToday').textContent = lateCount;
            } catch (error) {
                console.error('Error loading dashboard data:', error);
                showToast('Error loading data', 'danger');
            }
        }

        async function populatePeopleOptions() {
            const select = document.getElementById('recordPerson');
            select.innerHTML = '<option value="">Select a person</option>';

            const [studentsSnap, teachersSnap] = await Promise.all([
                getDocs(collection(db, 'students')),
                getDocs(collection(db, 'teachers'))
            ]);

            studentsSnap.forEach((d) => {
                const s = d.data();
                const opt = document.createElement('option');
                opt.value = `students:${d.id}`;
                opt.textContent = `${s.name} (Student${s.class ? ' - ' + s.class : ''})`;
                select.appendChild(opt);
            });

            teachersSnap.forEach((d) => {
                const t = d.data();
                const opt = document.createElement('option');
                opt.value = `teachers:${d.id}`;
                opt.textContent = `${t.name} (Teacher${t.subject ? ' - ' + t.subject : ''})`;
                select.appendChild(opt);
            });
        }

        async function loadRecentActivity() {
            try {
                const today = yyyymmddLocal();
                const qy = query(
                    collection(db, 'attendance'),
                    where('date', '==', today),
                    orderBy('timestamp', 'desc'),
                    limit(8)
                );
                const snap = await getDocs(qy);
                const container = document.getElementById('recentActivity');
                container.innerHTML = '';
                if (snap.empty) {
                    container.innerHTML = '<p class="text-muted mb-0">No activity yet today.</p>';
                    return;
                }
                snap.forEach((d) => {
                    const a = d.data();
                    const div = document.createElement('div');
                    div.className = 'notification-item';
                    div.innerHTML = `
                        <div><strong>${a.name || 'Unknown'}</strong> marked <strong>${(a.status || '').toUpperCase()}</strong></div>
                        <div class="notification-time">${a.time || ''}</div>
                    `;
                    container.appendChild(div);
                });
            } catch (e) {
                console.error(e);
            }
        }

        // ===== Actions: Save Attendance / Add Student / Add Teacher =====
        document.getElementById('saveRecordBtn').addEventListener('click', async () => {
            const value = document.getElementById('recordPerson').value;
            const status = document.getElementById('recordStatus').value;
            const time = document.getElementById('recordTime').value;
            if (!value) {
                showToast('Please select a person', 'danger');
                return;
            }
            const [collectionName, id] = value.split(':');
            try {
                const ref = doc(db, collectionName, id);
                const snap = await getDoc(ref);
                if (!snap.exists()) {
                    showToast('Selected person not found', 'danger');
                    return;
                }
                const data = snap.data();
                const today = yyyymmddLocal();
                await addDoc(collection(db, 'attendance'), {
                    personId: id,
                    personType: collectionName === 'students' ? 'student' : 'teacher',
                    name: data.name || '',
                    role: collectionName === 'students' ? 'Student' : 'Teacher',
                    status,
                    time: time || new Date().toLocaleTimeString(),
                    date: today,
                    timestamp: serverTimestamp()
                });
                showToast('Attendance record saved successfully');
                bootstrap.Modal.getInstance(document.getElementById('addRecordModal')).hide();
                await loadAllData();
            } catch (error) {
                console.error('Error saving record:', error);
                showToast('Error saving record', 'danger');
            }
        });

        document.getElementById('saveStudentBtn').addEventListener('click', async () => {
            const name = document.getElementById('studentName').value.trim();
            const studentClass = document.getElementById('studentClass').value.trim();
            const phone = document.getElementById('studentPhone').value.trim();
            const email = document.getElementById('studentEmail').value.trim();
            if (!name || !studentClass) {
                showToast('Please fill in all required fields', 'danger');
                return;
            }
            try {
                await addDoc(collection(db, 'students'), {
                    name, class: studentClass, phone, email, createdAt: serverTimestamp()
                });
                showToast('Student added successfully');
                bootstrap.Modal.getInstance(document.getElementById('addStudentModal')).hide();
                await loadAllData();
            } catch (error) {
                console.error('Error adding student:', error);
                showToast('Error adding student', 'danger');
            }
        });

        document.getElementById('saveTeacherBtn').addEventListener('click', async () => {
            const name = document.getElementById('teacherName').value.trim();
            const subject = document.getElementById('teacherSubject').value.trim();
            const phone = document.getElementById('teacherPhone').value.trim();
            const email = document.getElementById('teacherEmail').value.trim();
            if (!name || !subject) {
                showToast('Please fill in all required fields', 'danger');
                return;
            }
            try {
                await addDoc(collection(db, 'teachers'), {
                    name, subject, phone, email, createdAt: serverTimestamp()
                });
                showToast('Teacher added successfully');
                bootstrap.Modal.getInstance(document.getElementById('addTeacherModal')).hide();
                await loadAllData();
            } catch (error) {
                console.error('Error adding teacher:', error);
                showToast('Error adding teacher', 'danger');
            }
        });

        // ===== Simple Export/Print Hooks =====
        document.getElementById('printBtn').addEventListener('click', () => window.print());
        document.getElementById('downloadBtn').addEventListener('click', () => {
            // Simple CSV export for today's attendance
            const rows = [['Name','Role','Time','Status']];
            document.querySelectorAll('#attendanceTableBody tr').forEach(tr => {
                const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.replace(/,/g, ' '));
                rows.push([cells[0], cells[1], cells[2], cells[3]]);
            });
            const csv = rows.map(r => r.join(',')).join('\n');
            const blob = new Blob([csv], {type: 'text/csv'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `attendance_${yyyymmddLocal()}.csv`; 
            a.click();
        });

        document.getElementById('viewAllBtn').addEventListener('click', () => {
            showToast('View All not implemented in demo', 'danger');
        });