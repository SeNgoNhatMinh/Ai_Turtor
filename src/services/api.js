import { API_BASE_URL, API_TIMEOUTS, blobRequest, request, uploadRequest } from './apiClient';
import { asArray, normalizeImprovePlan, normalizeQuizAssignment, normalizeQuizSession } from './normalizers';
import { encodePath } from '../config/env';
import { normalizeReviewMode } from '../utils/validators';
import { authApi } from './authApi';

const normalizeAnswerReviewMode = (mode) => {
    return normalizeReviewMode(mode);
};

export const apiService = {
    // 0. User Authentication
    login: authApi.login,

    register: authApi.register,

    // 1. AI Conversations Sessions
    async getConversations(userId, courseId) {
        const params = new URLSearchParams({ userId });
        if (courseId) params.append('courseId', courseId);
        return await request(`${API_BASE_URL}/ai/conversations?${params}`);
    },

    async searchConversations(userId, keyword, courseId) {
        const params = new URLSearchParams({ userId, keyword });
        if (courseId) params.append('courseId', courseId);
        return await request(`${API_BASE_URL}/ai/conversations/search?${params}`);
    },

    async createConversation(userId, courseId) {
        const params = new URLSearchParams({ userId });
        if (courseId) params.append('courseId', courseId);
        return await request(`${API_BASE_URL}/ai/conversations?${params}`, { method: 'POST' });
    },

    async getMessages(sessionId, userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/ai/conversations/${encodePath(sessionId)}/messages?${params}`);
    },

    async deleteConversation(sessionId, userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/ai/conversations/${encodePath(sessionId)}?${params}`, { method: 'DELETE' });
    },

    async renameConversation(sessionId, newTitle, userId) {
        return await request(`${API_BASE_URL}/ai/conversations/${encodePath(sessionId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, userId })
        });
    },

    async pinChatMessage(sessionId, messageId, userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/ai/conversations/${encodePath(sessionId)}/messages/${encodePath(messageId)}/pin?${params}`, {
            method: 'PATCH'
        });
    },

    async unpinChatMessage(sessionId, messageId, userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/ai/conversations/${encodePath(sessionId)}/messages/${encodePath(messageId)}/pin?${params}`, {
            method: 'DELETE'
        });
    },

    async getPinnedMessages(sessionId, userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/ai/conversations/${encodePath(sessionId)}/pinned-messages?${params}`);
    },

    // 2. Query AI Tutor / Code Review
    async sendAiQuery(payload, userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/ai/query?${params}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeoutMs: API_TIMEOUTS.ai
        });
    },

    async classifyIntent(payload) {
        return await request(`${API_BASE_URL}/tutor/intent-classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async sendCodeMentorQuery(payload) {
        return await request(`${API_BASE_URL}/code-mentor/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeoutMs: API_TIMEOUTS.ai
        });
    },

    // 3. Materials Upload (Ingestion)
    async uploadMaterial(courseId, formData) {
        return await uploadRequest(
            `${API_BASE_URL}/courses/${encodePath(courseId)}/materials/upload`,
            formData,
            'Upload material failed',
            { timeoutMs: API_TIMEOUTS.upload }
        );
    },

    async getMaterial(courseId, materialId) {
        return await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}`);
    },

    async updateMaterialMetadata(courseId, materialId, payload) {
        return await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async deleteMaterial(courseId, materialId) {
        return await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}`, {
            method: 'DELETE'
        });
    },

    async reindexMaterial(courseId, materialId) {
        return await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/reindex`, {
            method: 'POST'
        });
    },

    async downloadMaterialPdf(courseId, materialId) {
        return await blobRequest(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/pdf`);
    },


    // 4. Assignments & Submissions
    async submitAssignment(assignmentId, formData, studentId) {
        const note = formData.get('note');
        const params = new URLSearchParams({ studentId });
        if (note) params.append('note', note);
        return await uploadRequest(`${API_BASE_URL}/students/assignments/${encodePath(assignmentId)}/submit?${params}`, formData, 'Submit failed');
    },

    async gradeSubmission(submissionId, payload) {
        return await request(`${API_BASE_URL}/mentor/submissions/${submissionId}/review`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async uploadAssignment(courseId, classId, formData) {
        return await uploadRequest(`${API_BASE_URL}/mentor/courses/${encodePath(courseId)}/classes/${encodePath(classId)}/assignments/upload`, formData, 'Upload assignment failed');
    },

    async downloadSubmissionFile(submissionId) {
        return await blobRequest(`${API_BASE_URL}/submissions/${encodePath(submissionId)}/file`);
    },

    async getStudentSubmissions(studentId) {
        return await request(`${API_BASE_URL}/students/${studentId}/submissions`);
    },

    async getStudentAssignments(studentId) {
        return await request(`${API_BASE_URL}/students/${studentId}/assignments`);
    },

    async getClassSubmissions(courseId, classId, teacherId) {
        return await request(`${API_BASE_URL}/mentor/courses/${courseId}/classes/${classId}/submissions?teacherId=${teacherId}`);
    },

    async getClassAssignments(courseId, classId, teacherId) {
        return await request(`${API_BASE_URL}/mentor/courses/${courseId}/classes/${classId}/assignments?teacherId=${teacherId}`);
    },

    async getAssignmentSubmissions(assignmentId, teacherId) {
        return await request(`${API_BASE_URL}/mentor/assignments/${assignmentId}/submissions?teacherId=${teacherId}`);
    },

    async getAssignment(assignmentId) {
        return await request(`${API_BASE_URL}/assignments/${encodePath(assignmentId)}`);
    },

    async updateAssignment(assignmentId, payload) {
        return await request(`${API_BASE_URL}/mentor/assignments/${encodePath(assignmentId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async deleteAssignment(assignmentId) {
        return await request(`${API_BASE_URL}/mentor/assignments/${encodePath(assignmentId)}`, { method: 'DELETE' });
    },

    async downloadAssignmentFile(assignmentId) {
        return await blobRequest(`${API_BASE_URL}/assignments/${encodePath(assignmentId)}/file`);
    },

    // 5. Support Requests & Suggested AI Answers
    async createEscalation(payload) {
        return await request(`${API_BASE_URL}/tutor/escalations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async answerEscalation(escalationId, payload) {
        return await request(`${API_BASE_URL}/tutor/escalations/${escalationId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async approveCandidate(candidateId, payload = {}) {
        return await request(`${API_BASE_URL}/tutor/escalations/knowledge-candidates/${candidateId}/approve`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    // 6. Suggestions
    async getSuggestions(studentId, courseId, options = {}) {
        const payload = {
            studentId,
            courseId,
            ...(options.classId ? { classId: options.classId } : {}),
            ...(options.question ? { question: options.question } : {}),
            ...(options.includeAiSuggestion != null ? { includeAiSuggestion: options.includeAiSuggestion } : {}),
        };

        return await request(`${API_BASE_URL}/tutor/improve-suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    // 7. Admin Configs
    async getAdminStats() {
        return await request(`${API_BASE_URL}/admin/dashboard/stats`);
    },

    async getSubscriptionPlans() {
        return asArray(await request(`${API_BASE_URL}/admin/subscription-plans`), 'plans', 'content');
    },

    async runDiagnostics() {
        const data = await request(`${API_BASE_URL}/health/llm-diagnostics`);
        return data.diagnostics;
    },

    async importMentors(formData) {
        return await uploadRequest(`${API_BASE_URL}/mentors/import`, formData, 'Import failed');
    },

    async getMentorImportTemplateSpec() {
        return await request(`${API_BASE_URL}/mentors/import/template`);
    },

    async downloadMentorImportTemplate() {
        return await blobRequest(`${API_BASE_URL}/mentors/import/template/download`);
    },

    async getStudentImportTemplateSpec() {
        return await request(`${API_BASE_URL}/admin/class-sections/students/import/template`);
    },

    async downloadStudentImportTemplate() {
        return await blobRequest(`${API_BASE_URL}/admin/class-sections/students/import/template.xlsx`);
    },

    async importClassStudents(courseId, classId, formData, options = {}) {
        const params = new URLSearchParams();
        if (options.semesterId) params.append('semesterId', options.semesterId);
        if (options.courseName) params.append('courseName', options.courseName);
        if (options.status) params.append('status', options.status);
        if (options.dryRun !== undefined) params.append('dryRun', String(Boolean(options.dryRun)));
        const qs = params.toString();
        return await uploadRequest(`${API_BASE_URL}/admin/class-sections/${encodePath(courseId)}/${encodePath(classId)}/students/import${qs ? `?${qs}` : ''}`, formData, 'Student import failed');
    },

    async enrollStudents(courseId, classId, payload) {
        return await request(`${API_BASE_URL}/admin/class-sections/${encodePath(courseId)}/${encodePath(classId)}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    // =============================================
    // 8. Admin Users CRUD
    // =============================================
    async getAdminUsers(q = '', role = '', active = '') {
        const params = new URLSearchParams();
        if (q) params.append('q', q);
        if (role) params.append('role', role);
        if (active !== '') params.append('active', active);
        return asArray(await request(`${API_BASE_URL}/admin/users?${params}`), 'users', 'content');
    },
    async updateAdminUser(userId, payload) {
        return await request(`${API_BASE_URL}/admin/users/${userId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async deleteAdminUser(userId) {
        return await request(`${API_BASE_URL}/admin/users/${userId}`, { method: 'DELETE' });
    },

    // 9. Admin Mentors CRUD
    async getAdminMentors(q = '') {
        const params = new URLSearchParams();
        if (q) params.append('q', q);
        const qs = params.toString();
        return asArray(await request(`${API_BASE_URL}/admin/mentors${qs ? `?${qs}` : ''}`), 'mentors', 'content');
    },
    async updateAdminMentor(mentorId, payload) {
        return await request(`${API_BASE_URL}/admin/mentors/${mentorId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async deleteAdminMentor(mentorId) {
        return await request(`${API_BASE_URL}/admin/mentors/${mentorId}`, { method: 'DELETE' });
    },

    // 10. Admin Support Requests
    async getAdminEscalations(status = '') {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        const qs = params.toString();
        return asArray(await request(`${API_BASE_URL}/admin/mentor-escalations${qs ? `?${qs}` : ''}`), 'escalations', 'content');
    },
    async deleteAdminEscalation(escalationId) {
        return await request(`${API_BASE_URL}/admin/mentor-escalations/${escalationId}`, { method: 'DELETE' });
    },

    // 11. Admin Subscription Plans CRUD
    async updateSubscriptionPlan(planId, payload) {
        return await request(`${API_BASE_URL}/admin/subscription-plans/${planId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async deleteSubscriptionPlan(planId) {
        return await request(`${API_BASE_URL}/admin/subscription-plans/${planId}`, { method: 'DELETE' });
    },

    // 12. Admin Subscriptions CRUD
    async getAdminSubscriptions(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
        return asArray(await request(`${API_BASE_URL}/admin/subscriptions?${params}`), 'subscriptions', 'content');
    },
    async assignSubscription(payload) {
        return await request(`${API_BASE_URL}/admin/subscriptions/assign`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async deleteSubscription(subscriptionId) {
        return await request(`${API_BASE_URL}/admin/subscriptions/${subscriptionId}`, { method: 'DELETE' });
    },
    async updateSubscriptionStatus(subscriptionId, status) {
        return await request(`${API_BASE_URL}/admin/subscriptions/${subscriptionId}/status`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
    },

    // =============================================
    // 13. Academic APIs
    // =============================================
    async getSemesters() {
        return asArray(await request(`${API_BASE_URL}/academic/semesters`), 'semesters', 'content');
    },
    async getSemester(semesterCode) {
        return await request(`${API_BASE_URL}/admin/semesters/${encodePath(semesterCode)}`);
    },
    async createSemester(payload) {
        return await request(`${API_BASE_URL}/academic/semesters`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async updateSemester(semesterCode, payload) {
        return await request(`${API_BASE_URL}/admin/semesters/${encodePath(semesterCode)}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async deleteSemester(semesterCode) {
        return await request(`${API_BASE_URL}/admin/semesters/${encodePath(semesterCode)}`, { method: 'DELETE' });
    },
    async getCourses(semesterId = '') {
        const params = new URLSearchParams();
        if (semesterId) params.append('semesterId', semesterId);
        const qs = params.toString();
        return asArray(await request(`${API_BASE_URL}/academic/courses${qs ? `?${qs}` : ''}`), 'courses', 'content');
    },
    async getCourse(courseId) {
        return await request(`${API_BASE_URL}/courses/${encodePath(courseId)}`);
    },
    async createCourse(payload) {
        return await request(`${API_BASE_URL}/academic/courses`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async updateCourse(courseId, payload) {
        return await request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async deleteCourse(courseId) {
        return await request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}`, { method: 'DELETE' });
    },
    async getClassSections(courseId) {
        return asArray(await request(`${API_BASE_URL}/academic/courses/${encodePath(courseId)}/class-sections`), 'classSections', 'classes', 'content');
    },
    async getClassSection(courseId, classId) {
        return await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}`);
    },
    async createClassSection(payload) {
        return await request(`${API_BASE_URL}/academic/class-sections`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async updateClassSection(courseId, classId, payload) {
        return await request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async deleteClassSection(courseId, classId) {
        return await request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}`, { method: 'DELETE' });
    },
    async getClassStudents(courseId, classId) {
        return await request(`${API_BASE_URL}/academic/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}/students`);
    },
    async createEnrollment(payload) {
        return await request(`${API_BASE_URL}/academic/enrollments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async getEnrollment(enrollmentId) {
        return await request(`${API_BASE_URL}/admin/enrollments/${encodePath(enrollmentId)}`);
    },
    async updateEnrollment(enrollmentId, payload) {
        return await request(`${API_BASE_URL}/admin/enrollments/${encodePath(enrollmentId)}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async deleteEnrollment(enrollmentId) {
        return await request(`${API_BASE_URL}/admin/enrollments/${encodePath(enrollmentId)}`, { method: 'DELETE' });
    },
    async removeStudentFromClass(courseId, classId, studentId) {
        return await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}/students/${encodePath(studentId)}`, {
            method: 'DELETE'
        });
    },
    async getTeacherClassSections(teacherId) {
        return await request(`${API_BASE_URL}/academic/mentors/${teacherId}/class-sections`);
    },
    async getTeacherCourses(teacherId) {
        return await request(`${API_BASE_URL}/academic/mentors/${teacherId}/courses`);
    },
    async getStudentEnrollments(studentId) {
        return await request(`${API_BASE_URL}/academic/students/${studentId}/enrollments`);
    },

    // =============================================
    // 14. Payment APIs
    // =============================================
    async createPayment(payload) {
        return await request(`${API_BASE_URL}/payments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async getUserPayments(userId) {
        return await request(`${API_BASE_URL}/payments/user/${userId}`);
    },
    async getPaymentDetail(paymentId) {
        return await request(`${API_BASE_URL}/payments/${paymentId}`);
    },
    async confirmPayment(paymentId, payload) {
        return await request(`${API_BASE_URL}/payments/${paymentId}/confirm`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    // =============================================
    // 15. Chat APIs (Realtime 1-1)
    // =============================================
    async sendChatMessage(payload) {
        return await request(`${API_BASE_URL}/chat/send`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async getChatHistory(chatRoomId, page = 0) {
        const params = new URLSearchParams({ chatRoomId, page });
        return asArray(await request(`${API_BASE_URL}/chat/history?${params}`), 'messages', 'content');
    },
    async getChatDetail(chatRoomId) {
        const params = new URLSearchParams({ chatRoomId });
        return await request(`${API_BASE_URL}/chat/detail?${params}`);
    },
    async getChatUnread(userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/chat/unread?${params}`);
    },
    async markChatRead(chatRoomId, userId) {
        return await request(`${API_BASE_URL}/chat/mark-read`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatRoomId, userId })
        });
    },
    async closeChat(payload) {
        return await request(`${API_BASE_URL}/chat/close`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    // =============================================
    // 16. Support Request Extended APIs
    // =============================================
    async getEscalationHistory(userId) {
        const params = new URLSearchParams({ userId });
        return asArray(await request(`${API_BASE_URL}/tutor/escalations/history?${params}`), 'escalations', 'content');
    },
    async cancelEscalation(payload) {
        return await request(`${API_BASE_URL}/tutor/escalations/cancel`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async offerEscalation(questionEscalationId) {
        const params = new URLSearchParams({ questionEscalationId });
        return await request(`${API_BASE_URL}/tutor/escalations/offer?${params}`, { method: 'POST' });
    },
    async selectEscalationMentor(payload) {
        return await request(`${API_BASE_URL}/tutor/escalations/select`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async getKnowledgeCandidates(status = '', courseId = '') {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (courseId) params.append('courseId', courseId);
        return asArray(await request(`${API_BASE_URL}/tutor/escalations/knowledge-candidates?${params}`), 'candidates', 'content');
    },
    async rejectCandidate(candidateId, payload = {}) {
        return await request(`${API_BASE_URL}/tutor/escalations/knowledge-candidates/${candidateId}/reject`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    // =============================================
    // 17. User Profile & Memory
    // =============================================
    async getUserProfile(userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/users/profile?${params}`);
    },
    async updateUserProfile(userId, payload) {
        return await request(`${API_BASE_URL}/users/${userId}/profile`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async changePassword(userId, payload) {
        return await request(`${API_BASE_URL}/users/${userId}/password`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async getStudentMemory(studentId, courseId) {
        return await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory`);
    },
    async updateStudentMemory(studentId, courseId, payload) {
        return await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async pinImproveSuggestion(studentId, courseId, suggestion) {
        return await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory/pinned-suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suggestion })
        });
    },
    async unpinImproveSuggestion(studentId, courseId, suggestion) {
        const params = new URLSearchParams({ suggestion });
        return await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory/pinned-suggestions?${params}`, {
            method: 'DELETE'
        });
    },
    async learnSuggestion(studentId, courseId, payload) {
        return await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/suggestions/learn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeoutMs: API_TIMEOUTS.ai
        });
    },
    async getCourseMemories(courseId, classId = '') {
        const params = new URLSearchParams();
        if (classId) params.append('classId', classId);
        const qs = params.toString();
        return await request(`${API_BASE_URL}/tutor/courses/${encodePath(courseId)}/memories${qs ? `?${qs}` : ''}`);
    },

    async getImprovePlans(studentId, courseId = '') {
        const params = new URLSearchParams();
        if (courseId) params.append('courseId', courseId);
        const qs = params.toString();
        return asArray(
            await request(`${API_BASE_URL}/students/${encodePath(studentId)}/improve-plans${qs ? `?${qs}` : ''}`),
            'plans',
            'content',
        ).map(normalizeImprovePlan);
    },

    async getLatestImprovePlan(studentId, courseId) {
        const data = await request(`${API_BASE_URL}/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/improve-plan`);
        return data?.plan === '' ? null : normalizeImprovePlan(data);
    },

    async completeImprovePlan(planId) {
        return normalizeImprovePlan(await request(`${API_BASE_URL}/improve-plans/${encodePath(planId)}/complete`, {
            method: 'PUT'
        }));
    },

    // =============================================
    // 18. Practice Quiz APIs
    // =============================================
    async generateSelfQuiz(studentId, courseId, payload) {
        return normalizeQuizSession(await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quizzes/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeoutMs: API_TIMEOUTS.quizGeneration
        }));
    },

    async submitQuiz(quizSessionId, payload) {
        return normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeoutMs: API_TIMEOUTS.ai
        }));
    },

    async getStudentQuizHistory(studentId, courseId) {
        return asArray(
            await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quizzes`),
            'quizzes',
            'content',
        ).map(normalizeQuizSession);
    },

    async getQuiz(quizSessionId) {
        return normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}`));
    },

    async getAssignedQuizzes(studentId, courseId, classId = '') {
        const params = new URLSearchParams();
        if (classId) params.append('classId', classId);
        const qs = params.toString();
        return asArray(
            await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quiz-assignments${qs ? `?${qs}` : ''}`),
            'assignments',
            'content',
        ).map(normalizeQuizAssignment);
    },

    async startQuizAssignmentAttempt(assignmentId, studentId) {
        const params = new URLSearchParams({ studentId });
        return normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quiz-assignments/${encodePath(assignmentId)}/attempts?${params}`, {
            method: 'POST',
            timeoutMs: API_TIMEOUTS.ai
        }));
    },

    async generateTeacherQuizDraft(teacherId, courseId, payload) {
        return await request(`${API_BASE_URL}/tutor/teachers/${encodePath(teacherId)}/courses/${encodePath(courseId)}/quiz-assignments/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeoutMs: API_TIMEOUTS.quizGeneration
        });
    },

    async updateQuizAssignment(assignmentId, payload) {
        return await request(`${API_BASE_URL}/tutor/quiz-assignments/${encodePath(assignmentId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async deleteQuizAssignment(assignmentId) {
        return await request(`${API_BASE_URL}/tutor/quiz-assignments/${encodePath(assignmentId)}`, { method: 'DELETE' });
    },

    async publishQuizAssignment(assignmentId, payload) {
        return await request(`${API_BASE_URL}/tutor/quiz-assignments/${encodePath(assignmentId)}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async getTeacherQuizAssignments(teacherId) {
        return asArray(await request(`${API_BASE_URL}/tutor/teachers/${encodePath(teacherId)}/quiz-assignments`), 'assignments', 'content');
    },

    async teacherReviewQuiz(quizSessionId, payload) {
        return await request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}/teacher-review`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeoutMs: API_TIMEOUTS.ai
        });
    },

    // =============================================
    // 19. Misc APIs
    // =============================================
    async getCourseMaterials(courseId, classId = '') {
        const params = new URLSearchParams();
        if (classId) params.append('classId', classId);
        const qs = params.toString();
        return await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials${qs ? `?${qs}` : ''}`);
    },
    async getMentors(category = '') {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        const qs = params.toString();
        return asArray(await request(`${API_BASE_URL}/mentors${qs ? `?${qs}` : ''}`), 'mentors', 'content');
    },
    async getMentorDetail(id) {
        return await request(`${API_BASE_URL}/mentors/${id}`);
    },
    async uploadCodeFileAI(formData, queryParams) {
        const params = new URLSearchParams(queryParams);
        return await uploadRequest(`${API_BASE_URL}/ai/code/upload?${params}`, formData, 'Upload code file failed', { timeoutMs: API_TIMEOUTS.ai });
    },
    async uploadCodeFileMentor(formData, queryParams) {
        const params = new URLSearchParams(queryParams);
        return await uploadRequest(`${API_BASE_URL}/code-mentor/upload?${params}`, formData, 'Upload code file failed', { timeoutMs: API_TIMEOUTS.ai });
    },

    // =============================================
    // 20. Learning Dashboards
    // =============================================
    async getStudentDashboard(studentId, courseId = '') {
        const params = new URLSearchParams();
        if (courseId) params.append('courseId', courseId);
        const qs = params.toString();
        return await request(`${API_BASE_URL}/students/${studentId}/dashboard${qs ? `?${qs}` : ''}`);
    },

    async getTeacherDashboard(teacherId, courseId = '', classId = '') {
        const params = new URLSearchParams();
        if (courseId) params.append('courseId', courseId);
        if (classId) params.append('classId', classId);
        const qs = params.toString();
        return await request(`${API_BASE_URL}/mentors/${teacherId}/dashboard${qs ? `?${qs}` : ''}`);
    },

    async getTeacherEscalationInbox(teacherId, filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
        const qs = params.toString();
        return await request(`${API_BASE_URL}/tutor/escalations/teachers/${teacherId}${qs ? `?${qs}` : ''}`);
    },

    // =============================================
    // 21. AI Answer Reviews
    // =============================================
    async getAnswerReviews(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
        return asArray(await request(`${API_BASE_URL}/tutor/answer-reviews?${params}`), 'reviews', 'content');
    },

    async getMentorPendingAnswerReviews(courseId = '') {
        const params = courseId ? `?courseId=${courseId}` : '';
        return asArray(await request(`${API_BASE_URL}/tutor/answer-reviews/mentor-pending${params}`), 'reviews', 'content');
    },

    async getSeniorPendingAnswerReviews(courseId = '') {
        const params = courseId ? `?courseId=${courseId}` : '';
        return asArray(await request(`${API_BASE_URL}/tutor/answer-reviews/senior-pending${params}`), 'reviews', 'content');
    },

    async submitAnswerReview(payload) {
        const normalizedPayload = {
            ...payload,
            mode: normalizeAnswerReviewMode(payload?.mode)
        };
        return await request(`${API_BASE_URL}/tutor/answer-reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(normalizedPayload)
        });
    },

    async seniorResolveAnswerReview(reviewId, payload) {
        return await request(`${API_BASE_URL}/tutor/answer-reviews/${reviewId}/senior-resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    // =============================================
    // 22. Diagnostics
    // =============================================
    async getHarnessLogs(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
        const qs = params.toString();
        return await request(`${API_BASE_URL}/admin/harness/logs${qs ? `?${qs}` : ''}`);
    },

    async getHarnessErrorLogs(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
        const qs = params.toString();
        return await request(`${API_BASE_URL}/admin/harness/logs/errors${qs ? `?${qs}` : ''}`);
    },
    
    async getTraceLogs(traceId) {
        return await request(`${API_BASE_URL}/admin/harness/logs/traces/${encodePath(traceId)}`);
    }
};
