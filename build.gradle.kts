
plugins {
    kotlin("multiplatform")
    kotlin("plugin.serialization") version "1.9.22"
}

allprojects {
    repositories {
        google()
        mavenCentral()
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

version = "1.0-SNAPSHOT"

kotlin {
    jvm("glow")

    js(IR) {
        browser()
    }
    applyDefaultHierarchyTemplate()

    sourceSets {
        commonMain.dependencies {
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-core:1.6.3")
        }
        val jvmMain by creating {
            dependsOn(commonMain.get())
        }
    }
}