CREATE DATABASE IF NOT EXISTS nexotech_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nexotech_db;

CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO roles (id, nombre) VALUES
  (1, 'admin'),
  (2, 'empleado'),
  (3, 'cliente')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

CREATE TABLE IF NOT EXISTS permisos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rol_id INT NOT NULL,
  modulo VARCHAR(50) NOT NULL,
  puede_gestionar TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_permiso_rol_modulo (rol_id, modulo),
  CONSTRAINT fk_permiso_rol
    FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

INSERT INTO permisos (rol_id, modulo, puede_gestionar) VALUES
  (1, 'usuarios', 1),
  (1, 'productos', 1),
  (1, 'servicios', 1),
  (2, 'usuarios', 0),
  (2, 'productos', 1),
  (2, 'servicios', 1),
  (3, 'usuarios', 0),
  (3, 'productos', 0),
  (3, 'servicios', 0)
ON DUPLICATE KEY UPDATE puede_gestionar = VALUES(puede_gestionar);

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  tipo_documento VARCHAR(20) NOT NULL,
  numero_documento VARCHAR(30) NOT NULL,
  direccion VARCHAR(200) NULL,
  correo VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  telefono VARCHAR(20) NULL,
  rol_id INT NOT NULL,
  estado VARCHAR(20) NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usuarios_correo (correo),
  CONSTRAINT fk_usuarios_rol
    FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  INDEX idx_reset_token_hash (token_hash),
  CONSTRAINT fk_reset_token_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(500) NULL,
  precio DECIMAL(10, 2) NOT NULL,
  stock INT NULL,
  estado VARCHAR(20) NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS servicios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(500) NULL,
  precio DECIMAL(10, 2) NOT NULL,
  estado VARCHAR(20) NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  referencia_pago VARCHAR(100) NULL UNIQUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedidos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS detalle_pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  tipo_item VARCHAR(20) NOT NULL,
  producto_id INT NULL,
  servicio_id INT NULL,
  nombre_item VARCHAR(100) NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_detalle_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_detalle_producto
    FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_detalle_servicio
    FOREIGN KEY (servicio_id) REFERENCES servicios(id)
) ENGINE=InnoDB;
