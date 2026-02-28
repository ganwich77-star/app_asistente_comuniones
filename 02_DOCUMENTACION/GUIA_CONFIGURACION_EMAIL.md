# 📧 Guía de Configuración de Emails en Firebase

## Problema Actual
Los emails no se están enviando porque falta configurar el sistema de envío en Firebase.

## Solución 1: Instalar Extension "Trigger Email" (RECOMENDADO)

### Paso 1: Acceder a Firebase Console
1. Abre: https://console.firebase.google.com/
2. Selecciona el proyecto: **asistente-digital-comuniones**

### Paso 2: Ir a Extensions
1. En el menú lateral izquierdo, busca **"Build"** (Compilar)
2. Haz clic en **"Extensions"** (Extensiones)
3. Verás una pantalla con extensiones disponibles

### Paso 3: Buscar e Instalar
1. Haz clic en **"Explore extensions"** o **"Install extension"**
2. En el buscador, escribe: **"Trigger Email"**
3. Selecciona: **"Trigger Email from Firestore"** (oficial de Firebase)
4. Haz clic en **"Install in console"**

### Paso 4: Configuración de la Extensión
Durante la instalación te pedirá:

#### A) Configuración Básica:
- **Collection path**: `mail`
- **Default FROM address**: `apps@pujaltefotografia.es`
- **Default REPLY-TO address**: `apps@pujaltefotografia.es`

#### B) Configuración SMTP (IMPORTANTE):
Necesitas un servicio de email. Opciones:

##### OPCIÓN A: Gmail (Más Fácil)
1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Seguridad → Verificación en 2 pasos (actívala si no está)
3. Contraseñas de aplicaciones → Crear nueva
4. Copia la contraseña generada (16 caracteres)
5. En Firebase, usa esta URI:
```
smtp://apps@pujaltefotografia.es:TU_CONTRASEÑA_APP@smtp.gmail.com:587
```

##### OPCIÓN B: SendGrid (Recomendado para Producción)
1. Regístrate en: https://sendgrid.com/ (gratis hasta 100 emails/día)
2. Verifica tu dominio o email
3. Crea una API Key
4. En Firebase, usa:
```
smtp://apikey:TU_API_KEY@smtp.sendgrid.net:587
```

### Paso 5: Finalizar Instalación
1. Revisa la configuración
2. Haz clic en **"Install extension"**
3. Espera 2-3 minutos a que se complete la instalación

---

## Solución 2: Usar EmailJS (Sin Backend)

Si no quieres configurar Firebase Extensions, puedes usar EmailJS:

### Paso 1: Crear cuenta en EmailJS
1. Ve a: https://www.emailjs.com/
2. Regístrate (gratis hasta 200 emails/mes)

### Paso 2: Configurar servicio
1. En el dashboard, ve a **"Email Services"**
2. Añade Gmail o tu proveedor de email
3. Copia el **Service ID**

### Paso 3: Crear plantilla
1. Ve a **"Email Templates"**
2. Crea una nueva plantilla para "Nuevo Lead"
3. Copia el **Template ID**

### Paso 4: Obtener Public Key
1. Ve a **"Account"** → **"General"**
2. Copia tu **Public Key**

### Paso 5: Actualizar el código
Te proporcionaré el código actualizado para usar EmailJS en lugar de Firebase.

---

## ¿Cuál elegir?

### Firebase Extension (Trigger Email)
✅ Integrado con Firestore
✅ Historial de emails en Firebase
✅ Más profesional
❌ Requiere configuración SMTP
❌ Más complejo

### EmailJS
✅ Configuración rápida (5 minutos)
✅ No requiere backend
✅ Gratis hasta 200 emails/mes
❌ No se guarda historial en Firebase
❌ Límite de emails más bajo

---

## Próximos Pasos

**¿Qué prefieres?**
1. Configurar Firebase Extension (más robusto)
2. Usar EmailJS (más rápido)

Dime cuál prefieres y te ayudo a configurarlo paso a paso.
