class Validators {
  static String? email(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Vui lòng nhập email';
    }
    final email = value.trim();
    final regex = RegExp(r'^[\w\.\-]+@[\w\-]+(\.[\w\-]+)+$');
    if (!regex.hasMatch(email)) {
      return 'Email không hợp lệ';
    }
    return null;
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập mật khẩu';
    }
    if (value.length < 6) {
      return 'Mật khẩu tối thiểu 6 ký tự';
    }
    return null;
  }

  static String? requiredField(String? value, {required String label}) {
    if (value == null || value.trim().isEmpty) {
      return 'Vui lòng nhập $label';
    }
    return null;
  }

  static String? phone(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final phone = value.trim();
    if (!RegExp(r'^0\d{9,10}$').hasMatch(phone)) {
      return 'Số điện thoại không hợp lệ';
    }
    return null;
  }
}
