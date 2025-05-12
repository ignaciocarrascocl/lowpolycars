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
    this.tireWidth = options.tireWidth ?? 2; // Ancho de las marcas de neumáticos
    this.wheelDistance = options.wheelDistance ?? 0.6; // Distancia desde el centro del coche a cada rueda lateralmente
    this.wheelBase = options.wheelBase ?? 1.4; // Distancia entre ejes delantero y trasero
    this.groundOffset = options.groundOffset ?? 0.02; // Offset desde el suelo para las marcas de neumáticos
    
    // Material para las marcas de neumáticos
    this.trailMaterial = new THREE.LineBasicMaterial({ 
      color: options.color ?? 0x111111, 
      transparent: true,
      opacity: options.opacity ?? 0.5,
      linewidth: options.linewidth ?? 2 // Nota: el linewidth no funciona en WebGLRenderer
    });
    
    // Crear dos líneas (una para cada lado)
    this.leftTrail = null;
    this.rightTrail = null;
    this.init();
  }

  init() {
    // Geometrías iniciales vacías para ambos trails
    const leftGeometry = new THREE.BufferGeometry();
    const rightGeometry = new THREE.BufferGeometry();
    
    // Crear dos líneas (una para cada lado del coche)
    this.leftTrail = new THREE.Line(leftGeometry, this.trailMaterial);
    this.rightTrail = new THREE.Line(rightGeometry, this.trailMaterial);
    
    // Añadir a la escena
    this.scene.add(this.leftTrail);
    this.scene.add(this.rightTrail);
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
      
      // Añadir las posiciones a los arrays de puntos
      this.trailPoints.left.push(leftWheelPos);
      this.trailPoints.right.push(rightWheelPos);
      
      // Limitar el número de puntos
      if (this.trailPoints.left.length > this.trailLength) {
        this.trailPoints.left.shift();
      }
      if (this.trailPoints.right.length > this.trailLength) {
        this.trailPoints.right.shift();
      }
      
      // Actualizar las geometrías de los trails
      this.updateGeometries();
    }
  }
  
  updateGeometries() {
    if (this.trailPoints.left.length > 1) {
      const leftGeometry = new THREE.BufferGeometry().setFromPoints(this.trailPoints.left);
      this.leftTrail.geometry.dispose();
      this.leftTrail.geometry = leftGeometry;
    }
    
    if (this.trailPoints.right.length > 1) {
      const rightGeometry = new THREE.BufferGeometry().setFromPoints(this.trailPoints.right);
      this.rightTrail.geometry.dispose();
      this.rightTrail.geometry = rightGeometry;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    this.leftTrail.visible = this.enabled;
    this.rightTrail.visible = this.enabled;
    
    if (!this.enabled) {
      this.clear();
    }
  }
  
  clear() {
    // Limpiar los puntos y resetear los trails
    this.trailPoints.left = [];
    this.trailPoints.right = [];
    
    const emptyGeometry = new THREE.BufferGeometry();
    
    this.leftTrail.geometry.dispose();
    this.rightTrail.geometry.dispose();
    
    this.leftTrail.geometry = emptyGeometry.clone();
    this.rightTrail.geometry = emptyGeometry.clone();
  }
  
  dispose() {
    // Limpiar recursos cuando ya no se necesiten
    if (this.leftTrail) {
      this.leftTrail.geometry.dispose();
      this.scene.remove(this.leftTrail);
    }
    
    if (this.rightTrail) {
      this.rightTrail.geometry.dispose();
      this.scene.remove(this.rightTrail);
    }
    
    if (this.trailMaterial) {
      this.trailMaterial.dispose();
    }
  }
}