import * as THREE from 'three';

export class TireTrailEffect {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.enabled = options.enabled ?? true;
    
    // Configuración de las propiedades del trail
    this.trailPoints = {
      left: [],
      right: []
    };
    this.trailLength = options.trailLength ?? 100; // Número máximo de puntos en el trail
    this.trailInterval = options.trailInterval ?? 3; // Número de frames entre cada punto de trail
    this.frameCounter = 0;
    this.tireWidth = options.tireWidth ?? 0.3; // Ancho de las marcas de neumáticos (en unidades de mundo)
    this.wheelDistance = options.wheelDistance ?? 0.6; // Distancia desde el centro del coche a cada rueda lateralmente
    this.wheelBase = options.wheelBase ?? 1.4; // Distancia entre ejes delantero y trasero
    this.groundOffset = options.groundOffset ?? 0.02; // Offset desde el suelo para las marcas de neumáticos
    
    // Material para las marcas de neumáticos
    this.trailMaterial = new THREE.MeshBasicMaterial({ 
      color: options.color ?? 0x111111, 
      transparent: true,
      opacity: options.opacity ?? 0.5,
      depthWrite: false // Evita problemas de z-fighting
    });
    
    // Crear meshes para las marcas de neumáticos
    this.leftTrailMeshes = [];
    this.rightTrailMeshes = [];
    
    // Último punto registrado para cada rueda
    this.lastLeftPoint = null;
    this.lastRightPoint = null;
  }

  update(vehicle) {
    if (!this.enabled || !vehicle) return;
    
    // Actualizar contador de frames
    this.frameCounter++;
    
    // Solo añadir puntos al trail cada cierto número de frames
    if (this.frameCounter >= this.trailInterval) {
      this.frameCounter = 0;
      
      // Posición y rotación del vehículo
      const vehiclePosition = vehicle.position.clone();
      const vehicleRotation = vehicle.rotation.y;
      const vehicleHeight = vehiclePosition.y;
      
      // Calcular la posición de las ruedas traseras (las que dejan marca)
      // Vector de desplazamiento hacia atrás desde el centro del vehículo
      const backwardOffset = new THREE.Vector3(0, 0, this.wheelBase/2);
      // Rotar según la orientación del vehículo
      backwardOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicleRotation);
      
      // Posición base de las ruedas traseras
      const rearPosition = vehiclePosition.clone().add(backwardOffset);
      
      // Vector de desplazamiento lateral para las ruedas
      const rightVector = new THREE.Vector3(1, 0, 0);
      rightVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicleRotation);
      rightVector.multiplyScalar(this.wheelDistance);
      
      // Posiciones finales de las ruedas traseras
      const leftWheelPos = rearPosition.clone().sub(rightVector);
      const rightWheelPos = rearPosition.clone().add(rightVector);
      
      // Ajustar altura para que la marca toque el suelo
      leftWheelPos.y = vehicleHeight + this.groundOffset;
      rightWheelPos.y = vehicleHeight + this.groundOffset;
      
      // Crear segmentos de trail si existen puntos previos
      if (this.lastLeftPoint) {
        this.createTrailSegment(this.lastLeftPoint, leftWheelPos, true);
      }
      if (this.lastRightPoint) {
        this.createTrailSegment(this.lastRightPoint, rightWheelPos, false);
      }
      
      // Guardar los puntos actuales como últimos puntos
      this.lastLeftPoint = leftWheelPos;
      this.lastRightPoint = rightWheelPos;
      
      // Añadir los puntos a los arrays para mantener un seguimiento
      this.trailPoints.left.push(leftWheelPos);
      this.trailPoints.right.push(rightWheelPos);
      
      // Limitar el número de puntos y eliminar meshes antiguos si es necesario
      this.limitTrailLength();
    }
  }
  
  createTrailSegment(startPoint, endPoint, isLeft) {
    // Vector dirección entre los dos puntos
    const direction = endPoint.clone().sub(startPoint);
    const length = direction.length();
    
    // Si los puntos están muy cerca, no creamos segmento
    if (length < 0.1) return;
    
    // Normalizar el vector dirección
    direction.normalize();
    
    // Vector perpendicular a la dirección en el plano horizontal (para el ancho)
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    
    // Crear los cuatro vértices del segmento (forma rectangular)
    const halfWidth = this.tireWidth / 2;
    const v1 = startPoint.clone().add(perpendicular.clone().multiplyScalar(halfWidth));
    const v2 = startPoint.clone().sub(perpendicular.clone().multiplyScalar(halfWidth));
    const v3 = endPoint.clone().sub(perpendicular.clone().multiplyScalar(halfWidth));
    const v4 = endPoint.clone().add(perpendicular.clone().multiplyScalar(halfWidth));
    
    // Crear geometría para el segmento
    const geometry = new THREE.BufferGeometry();
    
    // Vertices (2 triángulos para formar el rectángulo)
    const vertices = new Float32Array([
      // Primer triángulo
      v1.x, v1.y, v1.z,
      v2.x, v2.y, v2.z,
      v3.x, v3.y, v3.z,
      // Segundo triángulo
      v1.x, v1.y, v1.z,
      v3.x, v3.y, v3.z,
      v4.x, v4.y, v4.z
    ]);
    
    // Añadir los vértices a la geometría
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    
    // Crear mesh con la geometría y el material
    const mesh = new THREE.Mesh(geometry, this.trailMaterial);
    
    // Añadir el mesh a la escena y al array correspondiente
    this.scene.add(mesh);
    if (isLeft) {
      this.leftTrailMeshes.push(mesh);
    } else {
      this.rightTrailMeshes.push(mesh);
    }
  }
  
  limitTrailLength() {
    // Limitar el número de puntos
    while (this.trailPoints.left.length > this.trailLength) {
      this.trailPoints.left.shift();
      
      // Eliminar el mesh más antiguo si existe
      if (this.leftTrailMeshes.length > this.trailLength) {
        const oldMesh = this.leftTrailMeshes.shift();
        this.scene.remove(oldMesh);
        oldMesh.geometry.dispose();
      }
    }
    
    while (this.trailPoints.right.length > this.trailLength) {
      this.trailPoints.right.shift();
      
      // Eliminar el mesh más antiguo si existe
      if (this.rightTrailMeshes.length > this.trailLength) {
        const oldMesh = this.rightTrailMeshes.shift();
        this.scene.remove(oldMesh);
        oldMesh.geometry.dispose();
      }
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    
    // Mostrar u ocultar todos los segmentos
    this.leftTrailMeshes.forEach(mesh => {
      mesh.visible = this.enabled;
    });
    
    this.rightTrailMeshes.forEach(mesh => {
      mesh.visible = this.enabled;
    });
    
    if (!this.enabled) {
      this.clear();
    }
  }
  
  clear() {
    // Limpiar los puntos
    this.trailPoints.left = [];
    this.trailPoints.right = [];
    this.lastLeftPoint = null;
    this.lastRightPoint = null;
    
    // Eliminar todos los meshes
    this.leftTrailMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    
    this.rightTrailMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    
    // Resetear los arrays de meshes
    this.leftTrailMeshes = [];
    this.rightTrailMeshes = [];
  }
  
  dispose() {
    // Limpiar todos los recursos
    this.clear();
    
    if (this.trailMaterial) {
      this.trailMaterial.dispose();
    }
  }
  
  // Método para ajustar el ancho de las marcas de neumáticos
  setTireWidth(width) {
    this.tireWidth = width;
    // No hay necesidad de actualizar los segmentos ya creados, 
    // los nuevos segmentos usarán el nuevo ancho
  }
}