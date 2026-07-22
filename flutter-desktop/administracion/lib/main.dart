import 'dart:io';
import 'package:flutter/material.dart';
import 'package:webview_windows/webview_windows.dart';
import 'package:path/path.dart' as p;

// Título de la ventana / barra de tareas.
const String kAppTitle = 'Centro de Gestión Psicoluz · Administración';

void main() {
  runApp(const PsicoluzApp());
}

class PsicoluzApp extends StatelessWidget {
  const PsicoluzApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: kAppTitle,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: const Color(0xFF4A0E2E)),
      home: const WebviewHost(),
    );
  }
}

class WebviewHost extends StatefulWidget {
  const WebviewHost({super.key});
  @override
  State<WebviewHost> createState() => _WebviewHostState();
}

class _WebviewHostState extends State<WebviewHost> {
  final _controller = WebviewController();
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      await _controller.initialize();
      // `flutter build windows` copia los assets declarados en pubspec.yaml a:
      //   <exe>\data\flutter_assets\assets\app\index.html
      final exeDir = File(Platform.resolvedExecutable).parent.path;
      final indexPath = p.join(
        exeDir, 'data', 'flutter_assets', 'assets', 'app', 'index.html',
      );
      if (!File(indexPath).existsSync()) {
        setState(() => _error = 'No se encontró:\n$indexPath');
        return;
      }
      await _controller.loadUrl(Uri.file(indexPath).toString());
      setState(() {});
    } catch (e) {
      setState(() => _error = 'Error iniciando el WebView: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(_error!, textAlign: TextAlign.center),
          ),
        ),
      );
    }
    if (_controller.value.isInitialized) {
      return Scaffold(body: Webview(_controller));
    }
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
