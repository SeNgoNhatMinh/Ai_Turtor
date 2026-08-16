import 'package:flutter/material.dart';

abstract final class Shadows {
  static const md = [
    BoxShadow(color: Color(0x14211C18), blurRadius: 2, offset: Offset(0, 1)),
    BoxShadow(color: Color(0x0F211C18), blurRadius: 24, offset: Offset(0, 8)),
  ];

  static const lg = [
    BoxShadow(color: Color(0x14211C18), blurRadius: 4, offset: Offset(0, 2)),
    BoxShadow(color: Color(0x1A211C18), blurRadius: 40, offset: Offset(0, 16)),
  ];
}
