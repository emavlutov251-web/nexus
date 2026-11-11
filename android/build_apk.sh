#!/bin/bash
set -e
echo "=== Сборка APK для Nexus v3.5.0 ==="
echo "Структура: $(find . -name '*.gradle' -o -name 'AndroidManifest.xml' -o -name '*.kt' | wc -l) файлов"
echo "Проверка Java: $(java -version 2>&1 | head -1)"
echo "Проверка SDK: $ANDROID_HOME $ANDROID_SDK_ROOT"
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
    echo "ОШИБКА: Android SDK не найден в этой среде (ANDROID_HOME/$ANDROID_SDK_ROOT пустые)."
    echo "Это ограничение sandbox, а не ошибка кода."
    echo "Для сборки APK требуется Android Studio или Android SDK с build-tools."
    echo "Файлы сборки готовы (build.gradle, settings.gradle, Manifest, Kotlin-исходники)."
    exit 1
fi
