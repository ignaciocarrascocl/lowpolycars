import * as THREE from 'three';
import GuiManager from './guiManager.js';
import RoadManager from './roadManager.js';
import PlayerController from './playerController.js';
import TrafficManager from './trafficManager.js';
import CameraController from './cameraController.js';
import PostProcessingManager from './postProcessing.js';

export default class GameInit {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.cameraController = null;
    this.guiManager = null;
    this.directionalLight = null;
    this.ambientLight = null;
    this.playerLightLeft = null; // Luz para el faro izquierdo del coche del jugador
    this.playerLightRight = null; // Luz para el faro derecho del coche del jugador
    this.roadManager = null;
    this.playerController = null;
    this.trafficManager = null;
    this.postProcessing = null;
    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    // Configurar el renderizador
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // Configuración básica de la escena
    this.setupCamera();
    this.setupLights();
    this.setupGameSystems();

    // Eventos y animación
    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  setupCamera() {
    // Inicializar el controlador de cámara
    this.cameraController = new CameraController(this.renderer);
    this.camera = this.cameraController.getCamera();
  }

  setupLights() {
    // Luz ambiental muy tenue para ambiente nocturno
    this.ambientLight = new THREE.AmbientLight(0x101820, 0.2);
    this.scene.add(this.ambientLight);

    // Luz direccional principal (simula la luna) - tono azulado tenue
    this.directionalLight = new THREE.DirectionalLight(0x8ebbff, 0.3);
    this.directionalLight.position.set(-50, 80, 100);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.far = 500;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.scene.add(this.directionalLight);
    
    // Luces focales para los faros del coche (dos luces separadas)
    // Faro izquierdo
    this.playerLightLeft = new THREE.SpotLight(0xfff2d9, 4, 50, Math.PI/8, 0.7, 1);
    this.playerLightLeft.position.set(0, 0.7, 0);
    this.playerLightLeft.target.position.set(0, 0, -10);
    this.playerLightLeft.castShadow = true;
    this.playerLightLeft.shadow.mapSize.width = 512;
    this.playerLightLeft.shadow.mapSize.height = 512;
    this.scene.add(this.playerLightLeft);
    this.scene.add(this.playerLightLeft.target);
    
    // Faro derecho
    this.playerLightRight = new THREE.SpotLight(0xfff2d9, 4, 50, Math.PI/8, 0.7, 1);
    this.playerLightRight.position.set(0, 0.7, 0);
    this.playerLightRight.target.position.set(0, 0, -10);
    this.playerLightRight.castShadow = true;
    this.playerLightRight.shadow.mapSize.width = 512;
    this.playerLightRight.shadow.mapSize.height = 512;
    this.scene.add(this.playerLightRight);
    this.scene.add(this.playerLightRight.target);
    
    // Luz ambiental de suelo (bounce light) muy sutil para noche
    const groundLight = new THREE.HemisphereLight(0x303050, 0x101010, 0.15);
    this.scene.add(groundLight);
  }

  setupGameSystems() {
    // Configurar cielo nocturno
    this.scene.background = new THREE.Color(0x05101a); // Azul muy oscuro, casi negro
    
    // Configurar niebla para dar sensación de profundidad en ambiente nocturno
    this.scene.fog = new THREE.Fog(0x05101a, 50, 250);
    
    // Inicializar el sistema de carreteras
    this.roadManager = new RoadManager(this.scene);
    
    // Inicializar el controlador del jugador
    this.playerController = new PlayerController(this.scene, this.roadManager);
    
    // Inicializar el gestor de tráfico
    this.trafficManager = new TrafficManager(this.scene, this.roadManager);
    
    // Inicializar el gestor de post-procesamiento
    this.setupPostProcessing();
    
    // Configurar GUI para desarrollo (opcional)
    this.setupGui();
    
    // El plano de terreno ha sido eliminado
  }
  
  setupPostProcessing() {
    // Esperar a que la cámara esté disponible
    if (this.camera && this.renderer) {
      this.postProcessing = new PostProcessingManager(
        this.renderer,
        this.scene,
        this.camera
      );
    } else {
      // Si la cámara no está lista, intentarlo más tarde
      setTimeout(() => this.setupPostProcessing(), 100);
    }
  }
  
  setupGui() {
    // Crear la interfaz GUI después de cargar el sistema de juego
    const setupGuiInterval = setInterval(() => {
      if (this.roadManager && this.playerController && this.playerController.carModel) {
        clearInterval(setupGuiInterval);
        this.guiManager = new GuiManager(
          this.scene, 
          this.playerController.carModel,
          this.directionalLight, 
          this.ambientLight,
          this.roadManager,
          this.playerController  // Pasamos la referencia del controlador del jugador
        );
        
        // Pasar referencia de la cámara al GUI
        this.guiManager.setCamera(this.camera);
        
        // Pasar referencia del gestor de post-procesamiento al GUI
        if (this.postProcessing) {
          this.guiManager.setPostProcessing(this.postProcessing);
        }
      }
    }, 500);
  }

  onWindowResize() {
    // Usar el controlador de cámara para manejar el cambio de tamaño
    if (this.cameraController) {
      this.cameraController.onWindowResize();
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Redimensionar el compositor de post-procesamiento
    if (this.postProcessing) {
      this.postProcessing.resize();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    
    // Actualizar sistema de carreteras (ahora gestiona la generación de tramos según la posición del jugador)
    if (this.roadManager) {
      this.roadManager.update();
    }
    
    // Actualizar controlador del jugador (ahora mueve el coche)
    if (this.playerController) {
      this.playerController.update(delta);
    }
    
    // Actualizar gestor de tráfico con la posición Z del jugador
    if (this.trafficManager && this.playerController && this.playerController.carModel) {
      const playerZPosition = this.playerController.carModel.position.z;
      this.trafficManager.update(delta, playerZPosition);
    }
    
    // Actualizar la posición de las luces del jugador (faros)
    if (this.playerLightLeft && this.playerLightRight && this.playerController && this.playerController.carModel) {
      const playerPos = this.playerController.carModel.position.clone();
      const playerRot = this.playerController.carModel.rotation.y;
      
      // Vector hacia adelante del coche (Z negativo porque el modelo está rotado 180 grados)
      // Ya que el coche se mueve en dirección Z negativa
      const forwardVector = new THREE.Vector3(0, 0, -1);
      forwardVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerRot);
      
      // Vector lateral (perpendicular al forward)
      const rightVector = new THREE.Vector3(1, 0, 0);
      rightVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerRot);
      
      // Desplazamiento del frontal - el coche mira hacia Z negativo, así que este es el frente real
      const frontOffset = 1.5; // Ajustado para colocar las luces más adelante
      const frontPos = playerPos.clone().add(forwardVector.clone().multiplyScalar(-frontOffset));
      
      // Separación horizontal de los faros
      const headlightSpread = 0.6;
      
      // Posicionar los faros a la altura y separación correcta
      const leftHeadlightPos = frontPos.clone().add(rightVector.clone().multiplyScalar(-headlightSpread));
      leftHeadlightPos.y = playerPos.y + 0.6; // Altura ajustada
      
      const rightHeadlightPos = frontPos.clone().add(rightVector.clone().multiplyScalar(headlightSpread));
      rightHeadlightPos.y = playerPos.y + 0.6; // Altura ajustada
      
      // Asignar posiciones a las luces
      this.playerLightLeft.position.copy(leftHeadlightPos);
      this.playerLightRight.position.copy(rightHeadlightPos);
      
      // Calcular una posición objetivo común para ambos faros (20 unidades adelante)
      // Como el coche mira hacia Z negativo, necesitamos usar la dirección correcta
      const targetDistance = 30;
      const targetPos = frontPos.clone().add(forwardVector.clone().multiplyScalar(-targetDistance));
      targetPos.y = playerPos.y - 0.5; // Apuntar ligeramente hacia abajo
      
      // Asignar posición objetivo a los faros
      this.playerLightLeft.target.position.copy(targetPos);
      this.playerLightRight.target.position.copy(targetPos);
    }
    
    // Actualizar la cámara para seguir al jugador usando el controlador de cámara
    if (this.cameraController && this.playerController && this.guiManager) {
      this.cameraController.updateCamera(this.playerController, this.guiManager);
    }
    
    // Renderizar con post-procesamiento si está disponible, pasando la referencia del jugador
    // para que el efecto de profundidad de campo pueda hacer el enfoque automático
    if (this.postProcessing) {
      this.postProcessing.update(this.playerController);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}