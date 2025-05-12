import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

export default class PostProcessingManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    // Configuración básica de post-procesamiento
    this.params = {
      enabled: true,
      exposure: 1.0,      // Exposición global
      bokeh: {
        enabled: true,
        focus: 100.0,     // Distancia de enfoque
        aperture: 0.0001,   // Apertura (controla la cantidad de bokeh)
        maxblur: 0.005      // Desenfoque máximo
      }
    };
    
    this.composer = null;
    this.renderPass = null;
    this.outputPass = null;
    this.bokehPass = null;

    this.init();
  }

  init() {
    // Crear el composer
    this.composer = new EffectComposer(this.renderer);

    // Crear los passes
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // Añadir BokehPass para efecto bokeh
    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: this.params.bokeh.focus,
      aperture: this.params.bokeh.aperture,
      maxblur: this.params.bokeh.maxblur
    });
    this.composer.addPass(this.bokehPass);

    // Añadir OutputPass para garantizar que todo se renderice correctamente
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    // Ajustar la exposición del renderizador
    this.renderer.toneMappingExposure = this.params.exposure;
  }

  resize() {
    // Actualizar el tamaño del composer al redimensionar la ventana
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.composer.setSize(width, height);
  }

  update(playerController = null) {
    // Actualizar estado del bokeh si está habilitado
    if (this.bokehPass && this.params.bokeh.enabled) {
      this.bokehPass.enabled = true;
      
      // Si tenemos acceso al controlador del jugador, ajustar el enfoque al coche
      if (playerController) {
        const playerPosition = playerController.getPosition();
        const cameraPosition = this.camera.position.clone();
        
        // Calcular la distancia entre la cámara y el jugador
        const distanceToPlayer = cameraPosition.distanceTo(playerPosition);
        
        // Actualizar el enfoque del bokeh para que coincida con la distancia al jugador
        this.setBokehFocus(distanceToPlayer);
      }
    } else if (this.bokehPass) {
      this.bokehPass.enabled = false;
    }
    
    // Renderizar la escena a través del composer
    if (this.composer && this.params.enabled) {
      this.composer.render();
    } else if (this.renderer && this.scene && this.camera) {
      // Si los efectos están desactivados, renderizar normalmente
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Métodos simplificados de configuración
  setEnabled(enabled) {
    this.params.enabled = enabled;
  }

  setExposure(exposure) {
    this.params.exposure = exposure;
    if (this.renderer) {
      this.renderer.toneMappingExposure = exposure;
    }
  }

  // Métodos de control de bokeh
  setBokehEnabled(enabled) {
    this.params.bokeh.enabled = enabled;
  }

  setBokehFocus(focus) {
    this.params.bokeh.focus = focus;
    if (this.bokehPass) {
      this.bokehPass.uniforms["focus"].value = focus;
    }
  }

  setBokehAperture(aperture) {
    this.params.bokeh.aperture = aperture;
    if (this.bokehPass) {
      this.bokehPass.uniforms["aperture"].value = aperture;
    }
  }

  setBokehMaxBlur(maxblur) {
    this.params.bokeh.maxblur = maxblur;
    if (this.bokehPass) {
      this.bokehPass.uniforms["maxblur"].value = maxblur;
    }
  }

  // Método para compatibilidad con el código existente
  getDofParams() {
    // Actualizar para incluir los parámetros de bokeh
    return {
      enabled: this.params.enabled,
      exposure: this.params.exposure,
      autoFocus: false,
      bokehEnabled: this.params.bokeh.enabled,
      focus: this.params.bokeh.focus,
      aperture: this.params.bokeh.aperture,
      maxblur: this.params.bokeh.maxblur
    };
  }
}