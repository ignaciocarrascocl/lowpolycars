import * as THREE from 'three';

export default class CameraController {
  constructor(renderer) {
    this.camera = null;
    this.renderer = renderer;
    
    // Propiedades para transición suave
    this.currentPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    
    // Nuevo sistema de interpolación basado en velocidad
    this.speedTransitionFactor = 0; // 0 = config baja velocidad, 1 = config alta velocidad
    this.speedTransitionTarget = 0;
    
    // Configuraciones de cámara
    this.lowSpeedConfig = {
      height: 5,
      distance: 5,
      fov: 40
    };
    
    this.highSpeedConfig = {
      height: 2,
      distance: 8,
      fov: 20
    };
    
    // Inicializar cámara después de crear las propiedades necesarias
    this.init();
    
    // Configuración inicial
    this.setupEventListeners();
  }

  init() {
    this.setupCamera();
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    
    // Inicializar posiciones actuales y objetivos
    this.currentPosition.copy(this.camera.position);
    this.targetPosition.copy(this.camera.position);
    this.currentLookAt.set(0, 0, -20);
    this.targetLookAt.set(0, 0, -20);
  }
  
  setupEventListeners() {
    // Escuchar cambios de tamaño de ventana
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  
  setGuiManager(guiManager) {
    this.guiManager = guiManager;
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  updateCamera(playerController, guiManager) {
    if (!playerController || !playerController.carModel) return;
    
    // Obtener la velocidad del coche
    const carSpeed = playerController.getVelocity();
    
    // Determinar objetivo de transición basado en velocidad
    // 0 = configuración baja velocidad, 1 = configuración alta velocidad
    this.speedTransitionTarget = carSpeed > 600 ? 1 : 0;
    
    // Aplicar easing al factor de transición (transición suave entre configuraciones)
    // Velocidad de easing ajustable - más bajo = transición más suave pero más lenta
    const easingSpeed = 0.03;
    this.speedTransitionFactor += (this.speedTransitionTarget - this.speedTransitionFactor) * easingSpeed;
    
    // Interpolación entre las dos configuraciones de cámara
    const height = THREE.MathUtils.lerp(
      this.lowSpeedConfig.height, 
      this.highSpeedConfig.height, 
      this.speedTransitionFactor
    );
    
    const distance = THREE.MathUtils.lerp(
      this.lowSpeedConfig.distance, 
      this.highSpeedConfig.distance, 
      this.speedTransitionFactor
    );
    
    const fov = THREE.MathUtils.lerp(
      this.lowSpeedConfig.fov, 
      this.highSpeedConfig.fov, 
      this.speedTransitionFactor
    );
    
    // Coordenadas del coche
    const carPosition = playerController.carModel.position.clone();
    
    // Calcular la nueva posición objetivo de la cámara
    this.targetPosition.x = carPosition.x;
    this.targetPosition.y = carPosition.y + height;
    this.targetPosition.z = carPosition.z + distance;
    
    // Calcular punto de mira (siempre 10 unidades adelante del coche)
    this.targetLookAt.copy(carPosition);
    this.targetLookAt.z -= 10; // lookAheadDistance fijo en 10
    
    // Aplicar transición suave a la posición de la cámara
    const positionTransitionSpeed = 0.05;
    this.currentPosition.lerp(this.targetPosition, positionTransitionSpeed);
    this.currentLookAt.lerp(this.targetLookAt, positionTransitionSpeed);
    
    // Actualizar posición y orientación de la cámara
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
    
    // Actualizar FOV de la cámara de forma continua para permitir transiciones suaves
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
  
  calculateTargetPosition(carPosition, cameraControls) {
    // Este método ya no es necesario, la lógica se ha movido directamente a updateCamera
    // Mantenemos el método para compatibilidad, pero está vacío
  }
  
  applySmoothTransition(transitionSpeed) {
    // Interpolar suavemente entre posición actual y objetivo
    this.currentPosition.lerp(this.targetPosition, transitionSpeed);
    this.currentLookAt.lerp(this.targetLookAt, transitionSpeed);
    
    // Actualizar posición y orientación de la cámara
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  getCamera() {
    return this.camera;
  }
}