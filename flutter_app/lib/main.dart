import 'package:flutter/material.dart';
import 'package:flutter_scene/scene.dart';

import 'game.dart';

void main() {
  runApp(const ClumpApp());
}

class ClumpApp extends StatelessWidget {
  const ClumpApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Clump',
      debugShowCheckedModeBanner: false,
      home: FidgetView(),
    );
  }
}

class FidgetView extends StatefulWidget {
  const FidgetView({super.key});

  @override
  State<FidgetView> createState() => _FidgetViewState();
}

class _FidgetViewState extends State<FidgetView> {
  final Game _game = Game();
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _game.load().then((_) {
      if (mounted) setState(() => _ready = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(
        backgroundColor: Color(0xFF0C0B0A),
        body: SizedBox.expand(),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0C0B0A),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final viewSize = Size(constraints.maxWidth, constraints.maxHeight);
          return Listener(
            onPointerDown: (e) => _game.onPointerDown(e.localPosition, viewSize),
            onPointerMove: (e) => _game.onPointerMove(e.localPosition, viewSize),
            onPointerUp: (e) => _game.onPointerUp(),
            onPointerCancel: (e) => _game.onPointerUp(),
            child: SceneView(
              _game.scene,
              camera: _game.camera,
              onTick: (elapsed, dt) => _game.tick(dt),
            ),
          );
        },
      ),
    );
  }
}
