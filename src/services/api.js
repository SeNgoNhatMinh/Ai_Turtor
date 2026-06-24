import { API_BASE_URL, blobRequest, request, uploadRequest } from './apiClient';
import { asArray } from './normalizers';
import { encodePath } from '../config/env';
import { normalizeReviewMode } from '../utils/validators';

const normalizeAnswerReviewMode = (mode) => {
    return normalizeReviewMode(mode);
};

export const apiService = {
    // 0. User Authentication
    async login(email, password) {
        return await request(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
    },

    async register(userData) {
        return await request(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
    },

    // 1. AI Conversations Sessions
    async getConversations(userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/ai/conversations?${params}`);
    },

    async createConversation(userId) {
        const params = new URLSearchParams({ userId });
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

    // 2. Query AI Tutor / Code Review
    async sendAiQuery(payload, userId) {
        const params = new URLSearchParams({ userId });
        return await request(`${API_BASE_URL}/ai/query?${params}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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
            body: JSON.stringify(payload)
        });
    },

    // 3. Materials Upload (Ingestion)
    async uploadMaterial(courseId, formData) {
        return await uploadRequest(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/upload`, formData);
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
    async getSuggestions(studentId, courseId) {
        return await request(`${API_BASE_URL}/tutor/improve-suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, courseId })
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
    async createSemester(payload) {
        return await request(`${API_BASE_URL}/academic/semesters`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async getCourses(semesterId = '') {
        const params = new URLSearchParams();
        if (semesterId) params.append('semesterId', semesterId);
        const qs = params.toString();
        return asArray(await request(`${API_BASE_URL}/academic/courses${qs ? `?${qs}` : ''}`), 'courses', 'content');
    },
    async createCourse(payload) {
        return await request(`${API_BASE_URL}/academic/courses`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async getClassSections(courseId) {
        return asArray(await request(`${API_BASE_URL}/academic/courses/${courseId}/class-sections`), 'classSections', 'classes', 'content');
    },
    async createClassSection(payload) {
        return await request(`${API_BASE_URL}/academic/class-sections`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async getClassStudents(courseId, classId) {
        return await request(`${API_BASE_URL}/academic/courses/${courseId}/class-sections/${classId}/students`);
    },
    async createEnrollment(payload) {
        return await request(`${API_BASE_URL}/academic/enrollments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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
    async getStudentMemory(studentId, courseId) {
        return await request(`${API_BASE_URL}/tutor/students/${studentId}/courses/${courseId}/memory`);
    },
    async updateStudentMemory(studentId, courseId, payload) {
        return await request(`${API_BASE_URL}/tutor/students/${studentId}/courses/${courseId}/memory`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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
        return asArray(await request(`${API_BASE_URL}/students/${studentId}/improve-plans${qs ? `?${qs}` : ''}`), 'plans', 'content');
    },

    async getLatestImprovePlan(studentId, courseId) {
        return await request(`${API_BASE_URL}/students/${studentId}/courses/${courseId}/improve-plan`);
    },

    async completeImprovePlan(planId) {
        return await request(`${API_BASE_URL}/improve-plans/${planId}/complete`, {
            method: 'PUT'
        });
    },

    // =============================================
    // 18. Misc APIs
    // =============================================
    async getCourseMaterials(courseId) {
        return await request(`${API_BASE_URL}/courses/${courseId}/materials`);
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
        return await uploadRequest(`${API_BASE_URL}/ai/code/upload?${params}`, formData);
    },
    async uploadCodeFileMentor(formData, queryParams) {
        const params = new URLSearchParams(queryParams);
        return await uploadRequest(`${API_BASE_URL}/code-mentor/upload?${params}`, formData);
    },

    // =============================================
    // 19. Learning Dashboards
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
    // 20. AI Answer Reviews
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
    }
};
