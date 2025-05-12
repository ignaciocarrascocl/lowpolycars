import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TireTrailEffect } from './effects.js';

export default class PlayerController {
  constructor(scene, roadManager) {
    this.scene = scene;
    this.roadManager = roadManager;
    this.carModel = null;
    this.currentLane = 2; // Empezamos en el segundo carril (0-3)
    this.targetLane = 1;
    this.laneChangeSpeed = 0.2; // Aumentado para ser proporcional a la nueva velocidad
    this.movingLane = false;
    this.carHeight = 0.2; // Altura del coche sobre la carretera
    
    // Parámetros de velocidad del coche
    this.defaultSpeed = 400; // Velocidad predeterminada 10x más alta
    this.velocity = this.defaultSpeed; // Iniciar con la velocidad predeterminada
    this.minSpeed = 200;    // Velocidad mínima 10x más alta
    this.maxSpeed = 800;    // Velocidad máxima 10x más alta
    this.speedDelta = 50;   // Incremento/decremento de velocidad aumentado 10x
    this.speedFactor = 0.05; // Mantenemos el mismo factor de conversión
    
    // Parámetros para el giro del coche
    this.forwardDirection = Math.PI;  // Dirección "adelante" (PI = 180 grados)
    this.steeringAngle = Math.PI / 8; // Ángulo máximo de giro (22.5 grados)
    this.changeLanePhase = 0;         // Fase de la animación (0 a 1)
    
    // Control de entrada
    this.increaseSpeed = false;
    this.decreaseSpeed = false;
    
    // Inicializar efectos
    this.tireTrail = new TireTrailEffect(scene, {
      wheelDistance: 0.6,
      wheelBase: 1.4,
      groundOffset: 0.02
    });
    
    // Configurar inputs
    this.setupInputs();
    
    // Cargar el modelo
    this.init();
  }

  async init() {
    await this.loadCarModel();
    this.positionCar();
  }

  async loadCarModel() {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load('/models/cars/sedan-sports.glb', (gltf) => {
        this.carModel = gltf.scene;
        
        // Configurar el modelo para que proyecte sombras
        this.carModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        // Rotar el coche para que mire hacia el camino
        this.carModel.rotation.y = Math.PI;
        
        // Ajustar escala si es necesario
        this.carModel.scale.set(1, 1, 1);
        
        // Añadir el coche a la escena
        this.scene.add(this.carModel);
        
        resolve();
      });
    });
  }

  setupInputs() {
    // Escuchar eventos de teclado para cambiar de carril y controlar velocidad
    document.addEventListener('keydown', (event) => {
      if (this.movingLane && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return; // No permitir cambios de carril mientras está en movimiento

      switch (event.key) {
        case 'ArrowLeft':
          this.changeToLane(Math.max(0, this.currentLane - 1));
          break;
        case 'ArrowRight':
          this.changeToLane(Math.min(3, this.currentLane + 1));
          break;
        case 'ArrowUp':
          this.increaseSpeed = true;
          break;
        case 'ArrowDown':
          this.decreaseSpeed = true;
          break;
      }
    });
    
    document.addEventListener('keyup', (event) => {
      switch (event.key) {
        case 'ArrowUp':
          this.increaseSpeed = false;
          break;
        case 'ArrowDown':
          this.decreaseSpeed = false;
          break;
      }
    });
  }

  changeToLane(laneIndex) {
    if (laneIndex === this.currentLane) return;
    
    this.targetLane = laneIndex;
    this.movingLane = true;
    this.changeLanePhase = 0; // Reiniciar la fase de animación
  }

  positionCar() {
    if (!this.carModel) return;
    
    // Obtener posición X basada en el carril actual
    const xPos = this.roadManager.getLanePosition(this.currentLane);
    
    // Actualizar posición del coche
    this.carModel.position.x = xPos;
    this.carModel.position.y = this.carHeight;
    this.carModel.position.z = 0; // Inicialmente en la posición 0
    
    // Informar al roadManager de la posición inicial del jugador
    this.roadManager.setPlayerZPosition(0);
  }

  update(deltaTime) {
    if (!this.carModel) return;
    
    // Actualizar velocidad según controles de aceleración y frenado
    this.updateVelocity(deltaTime);
    
    // Mover el coche hacia adelante según su velocidad
    this.updateForwardMovement(deltaTime);
    
    // Actualizar la posición del coche según el carril
    this.updateLanePosition(deltaTime);
    
    // Actualizar el trail del coche
    this.updateTrail();
  }
  
  updateVelocity(deltaTime) {
    // Aplicar incremento o decremento de velocidad según el estado de los controles
    if (this.increaseSpeed) {
      this.velocity = Math.min(this.velocity + this.speedDelta, this.maxSpeed);
    } else if (this.decreaseSpeed) {
      this.velocity = Math.max(this.velocity - this.speedDelta, this.minSpeed);
    }
  }
  
  updateForwardMovement(deltaTime) {
    // Aplicar velocidad para mover el coche hacia adelante
    const moveAmount = this.velocity * this.speedFactor * deltaTime;
    
    // Actualizar la posición Z del coche
    this.carModel.position.z -= moveAmount; // Restamos porque el eje Z negativo es "adelante"
    
    // Informar al roadManager de la nueva posición del jugador
    this.roadManager.setPlayerZPosition(this.carModel.position.z);
  }
  
  updateLanePosition(deltaTime) {
    if (this.movingLane) {
      // Calcular la posición X objetivo
      const targetX = this.roadManager.getLanePosition(this.targetLane);
      const currentX = this.carModel.position.x;
      
      // Determinar la dirección del cambio de carril
      const direction = targetX > currentX ? 1 : -1;
      const moveAmount = this.laneChangeSpeed * deltaTime * 60; // Normalizar por frame rate
      
      // Actualizar la fase de la animación (0 a 1)
      this.changeLanePhase += moveAmount / Math.abs(targetX - this.roadManager.getLanePosition(this.currentLane));
      this.changeLanePhase = Math.min(this.changeLanePhase, 1); // Asegurar que no pase de 1
      
      if (Math.abs(targetX - currentX) <= moveAmount) {
        // Llegó al objetivo
        this.carModel.position.x = targetX;
        this.currentLane = this.targetLane;
        this.movingLane = false;
        this.changeLanePhase = 0;
        
        // Restaurar la rotación normal
        this.carModel.rotation.y = this.forwardDirection;
        this.carModel.rotation.z = 0;
      } else {
        // Seguir moviendo
        this.carModel.position.x += direction * moveAmount;
        
        // Aplicar el giro del coche en función de la fase de la animación
        // Primero giramos hacia el lado que vamos a cambiar, luego volvemos a la posición recta,
        // finalmente giramos ligeramente en dirección contraria para "enderezar" el coche
        let steeringFactor = 0;
        
        if (this.changeLanePhase < 0.3) {
          // Fase inicial: girar hacia el lado que vamos a cambiar (0% a 100% del giro)
          steeringFactor = this.changeLanePhase / 0.3;
        } else if (this.changeLanePhase < 0.7) {
          // Fase intermedia: volver gradualmente a la posición recta (100% a 0% del giro)
          steeringFactor = 1 - ((this.changeLanePhase - 0.3) / 0.4);
        } else {
          // Fase final: girar ligeramente en dirección contraria (0% a -30% y vuelta a 0%)
          const endPhase = (this.changeLanePhase - 0.7) / 0.3;
          steeringFactor = -0.3 * Math.sin(endPhase * Math.PI);
        }
        
        // Aplicar rotación en Y (volante)
        this.carModel.rotation.y = this.forwardDirection - (direction * this.steeringAngle * steeringFactor);
        
        // Añadir inclinación lateral (rotación en Z)
        const tiltAmount = direction * 0.1 * Math.sin(this.changeLanePhase * Math.PI);
        this.carModel.rotation.z = tiltAmount;
      }
    } else {
      // Asegurarnos de que el coche vuelva gradualmente a su rotación normal cuando no está cambiando de carril
      if (this.carModel.rotation.z !== 0 || this.carModel.rotation.y !== this.forwardDirection) {
        this.carModel.rotation.z = THREE.MathUtils.lerp(this.carModel.rotation.z, 0, 0.1);
        this.carModel.rotation.y = THREE.MathUtils.lerp(this.carModel.rotation.y, this.forwardDirection, 0.1);
      }
    }
  }

  updateTrail() {
    if (this.carModel) {
      this.tireTrail.update(this.carModel);
    }
  }

  toggleTrail() {
    this.tireTrail.toggle();
  }

  getPosition() {
    return this.carModel ? this.carModel.position.clone() : new THREE.Vector3(0, 0, 0);
  }

  getVelocity() {
    return this.velocity;
  }

  reset() {
    // Reiniciar posición del coche
    this.currentLane = 1;
    this.targetLane = 1;
    this.movingLane = false;
    this.velocity = this.defaultSpeed;
    this.increaseSpeed = false;
    this.decreaseSpeed = false;
    
    // Limpiar el trail
    this.tireTrail.clear();
    
    if (this.carModel) {
      this.positionCar();
    }
  }
}