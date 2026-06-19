import java.util.Base64

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Extract --dart-define values so they can be injected into the Android manifest.
// Flutter encodes each define as base64("KEY=VALUE") and joins them with commas.
fun dartDefines(): Map<String, String> {
    val raw = project.findProperty("dart-defines") as String? ?: return emptyMap()
    return raw.split(",")
        .mapNotNull { encoded ->
            runCatching {
                String(Base64.getDecoder().decode(encoded.trim()))
            }.getOrNull()
        }
        .mapNotNull { kv ->
            val idx = kv.indexOf('=')
            if (idx < 1) null else kv.substring(0, idx) to kv.substring(idx + 1)
        }
        .toMap()
}

val defines = dartDefines()

android {
    namespace = "com.smartwash.smartwash_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.smartwash.smartwash_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // Inject the GOOGLE_MAPS_KEY dart-define into the manifest placeholder.
        // If not provided, the placeholder is left empty so the build still succeeds
        // (the map screen shows a placeholder tile instead).
        manifestPlaceholders["googleMapsKey"] = defines["GOOGLE_MAPS_KEY"] ?: ""
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
