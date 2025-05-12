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
    // Luz ambiental
    this.ambientLight = new THREE.AmbientLight(0x404040, 1);
    this.scene.add(this.ambientLight);

    // Luz direccional principal (simula el sol)
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.directionalLight.position.set(50, 100, 50);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.far = 500;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.scene.add(this.directionalLight);
    
    // Añadir una luz puntual para el coche del jugador
    const playerLight = new THREE.PointLight(0xffffff, 0.5, 20);
    playerLight.position.set(0, 5, 10);
    this.scene.add(playerLight);
  }

  setupGameSystems() {
    // Configurar cielo
    this.scene.background = new THREE.Color(0x87ceeb); // Azul claro para el cielo
    
    // Configurar niebla para dar sensación de profundidad
    this.scene.fog = new THREE.Fog(0x87ceeb, 100, 500);
    
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
    
    // Añadir un plano que simule el terreno
    this.setupTerrain();
  }
  
  setupTerrain() {
    // Crear un plano grande para simular terreno base
    const terrainGeometry = new THREE.PlaneGeometry(2000, 2000);
    const terrainMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3a7e4f,  // Verde para simular hierba/terreno
      roughness: 0.8,
      metalness: 0.2
    });
    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.rotation.x = -Math.PI / 2; // Rotar para que esté horizontal
    terrain.position.y = -0.1; // Ligeramente por debajo de la carretera
    terrain.receiveShadow = true;
    this.scene.add(terrain);
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