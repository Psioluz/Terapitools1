import 'dart:io';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_win_floating/webview_win_floating.dart';
import 'package:path/path.dart' as p;

// Título de la ventana / barra de tareas.
const String kAppTitle = 'Psicoluz Recepción';

void main() {
  if (Platform.isWindows) {
    WebViewPlatform.instance = WinWebViewPlatform();
  }
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
  WebViewController? _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
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
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..loadRequest(Uri.file(indexPath));
      setState(() => _controller = controller);
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
    if (_controller != null) {
      return Scaffold(body: WebViewWidget(controller: _controller!));
    }
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
