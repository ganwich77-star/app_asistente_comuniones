<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!empty($data)) {
        $to = "hola@basecode.es"; // Email configurado
        $subject = "Nuevo Registro de Asistencia - " . ($data['eventName'] ?? 'Evento');
        
        $message = "Has recibido una nueva confirmación de asistencia:\n\n";
        $message .= "Nombre: " . ($data['nombres'] ?? 'N/A') . "\n";
        $message .= "Adultos: " . ($data['adultos'] ?? 0) . "\n";
        $message .= "Niños: " . ($data['niños'] ?? 0) . "\n";
        
        // Formatear menú si existe
        if (isset($data['menu']) && is_array($data['menu'])) {
            $message .= "Menú seleccionado:\n";
            foreach ($data['menu'] as $plato => $cantidad) {
                if ($cantidad > 0) {
                    $message .= " - $plato: $cantidad\n";
                }
            }
        }
        
        $message .= "Comentarios: " . ($data['comentarios'] ?? 'Ninguno') . "\n";
        $message .= "Fecha: " . ($data['fecha'] ?? date('Y-m-d H:i:s')) . "\n";
        
        $headers = "From: no-reply@basecode.es\r\n";
        $headers .= "Reply-To: no-reply@basecode.es\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion();

        if (mail($to, $subject, $message, $headers)) {
            echo json_encode(["status" => "success", "message" => "Email enviado correctamente."]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error al enviar el email."]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Datos incompletos."]);
    }
} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Método no permitido."]);
}
?>
