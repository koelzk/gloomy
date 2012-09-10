define(
  [ 'jquery', 'libs/gl-matrix' ],
    /**
     * Contains the gloomy code
     * @exports gloomy
     * @version 0.01
     */    
  function($, gm) {
    
  /**
   * WebGL context
   * @type {WebGLRenderingContext}
   */  
  var gl = null;
  /**
   * Canvas that is used WebGL viewport
   * @type {DOMElement}
   */  
  var canvas = null;
  /**
   * Canvas aspect ratio
   * @type {number}
   */
  var canvasAspectRatio = 1.0;
  
  /**
   * Adjusts the width and height of the viewport to the
   * dimensions of the current WebGL canvas.
   */
  var reshapeViewport = function() {
    if (!gl) {
      return;
    }
    
    if (canvas.oldwidth == canvas.width
        && canvas.oldheight == canvas.height) {
      return;
    }
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    canvas.oldwidth = canvas.clientWidth;
    canvas.oldheight = canvas.clientHeight;
    canvasAspectRatio = canvas.width / canvas.height;

    // Set the viewport:
    gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
  };
  
  /**
   * Schedules a new animation frame. 
   * The specified callback function is called as soon as the
   * next frame is due.
   * @param {function} callback
   */
  var requestAnimFrame = (function() {
    return window.requestAnimationFrame ||
       window.webkitRequestAnimationFrame ||
       window.mozRequestAnimationFrame ||
       window.oRequestAnimationFrame ||
       window.msRequestAnimationFrame ||
       function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
         window.setTimeout(callback, 1000/60);
       };
  })();
  
  /**
   * Creates the WebGL context for the canvas with the specified ID.
   * @param {string} ID of the canvas that gets the WebGL context
   * @returns {WebGLRenderingContext} WebGL context  
   */
  var createGLContext = function(canvasID) {
    canvas = document.getElementById(canvasID);
    gl = canvas.getContext("experimental-webgl");
    
    gl.enable(gl.CULL_FACE); // Enable back-face culling:
    gl.cullFace(gl.BACK);
    gl.enable(gl.DEPTH_TEST); // Enable depth-testing
    return gl;
  };

  /**
   * Provides compatible setter functions for assigning values to
   * uniform matrices.
   * @type {Array.<function(WebGLUniformLocation, Float32Array)>}
   */
  var uniformMatrixSetFunc = 
    [function(location, mat) { gl.uniformMatrix2fv(location, false, mat); },
     function(location, mat) { gl.uniformMatrix3fv(location, false, mat); },
     function(location, mat) { gl.uniformMatrix4fv(location, false, mat); } ];
                            
    /**
     * Returns a setter function for the uniform variable of the specified
     * type
     * @param {number} size Size of the uniform reported by WebGL
     * @param {number} type Type of the uniform reported by WebGL
     * @returns {function(number, any)} Setter function to assign a value
     *   for a specified location and value of this uniform type 
     */
    var getUniformSetFunc = function(size, type) {
      if (type >= gl.FLOAT_MAT2 && type <= gl.FLOAT_MAT4) {
        return uniformMatrixSetFunc[type - gl.FLOAT_MAT2];
      }
      // Assign size suffix:
      if (type === gl.FLOAT || type === gl.SAMPLER_2D ||
          type === gl.SAMPLER_CUBE || type === gl.INT || type === gl.BOOL)
        size = 1;
      else if (type >= gl.FLOAT_VEC2 && type <= gl.FLOAT_VEC4)
        size = type - gl.FLOAT_VEC2 + 2;
      else if (type >= gl.INT_VEC2 && type <= gl.INT_VEC2)
        size = type - gl.INT_VEC2 + 2;
      else if (type >= gl.BOOL_VEC2 && type <= gl.BOOL_VEC2)
        size = type - gl.BOOL_VEC2 + 2;
      var sizeSuffix = size.toString();
      
      // Assign type suffix:
      var typeSuffix = 'v';
      if (type === gl.FLOAT ||
          (type >= gl.FLOAT_VEC2 && type <= gl.FLOAT_VEC4))
        typeSuffix = 'f';
      else 
        typeSuffix = 'i';
      var vecSuffix = size > 1 ? 'v' : '';
      var name = 'uniform' + sizeSuffix + typeSuffix + vecSuffix;
      //return function(location, value) { gl[name](location, value); };
      return gl[name].bind(gl);
    };  
  
  /**
   * Returns the key of the first element with the specified value
   * @param {object} object Object that is iterated through 
   * @param {any} value Value of the element that is searched
   * @returns {any} Key of the element with specified value 
   */
  var findFirstKey = function(object, value) {
    var result = null;
    $.each(object, function(key, v) {
      if (v === value) {
        result = key;
        return false;
      }
    });
    return result;
  };

  /**
   * Loads a shader resource asynchronously 
   * @param {string} fileName Relative URL to file
   * @param {function(string, Effect)} callback Callback that is invoked as soon
   *  as the shader has been loaded. The first argument is the URL and the
   *  second argument is the created Effect instance.
   */
  var resourceShaderLoader = function(fileName, callback) {
    var processShader = function(program, source, type) {
      var shader = gl.createShader(gl[type]);
      gl.shaderSource(shader, "#define " + type + "\n" + source);
      gl.compileShader(shader);
      var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true &&
        gl.getError() === gl.NO_ERROR;
      
      if (success) {
        console.log('Successfully compiled shader ' + fileName + ' (' +
            type + ').');
        gl.attachShader(program, shader);
      }
      else {
        console.log('Could not compile shader (' + type + ') ' + fileName +
          ':\n' + gl.getShaderInfoLog(shader));
      }
      return success;
    };
    
    var onGetShaderSource = function(source) {
      var program = gl.createProgram();
      // Processing vertex and fragment shader:
      if (processShader(program, source, 'VERTEX_SHADER') &&        
        processShader(program, source, 'FRAGMENT_SHADER')) {
        // Link program
        gl.linkProgram(program);
        gl.validateProgram(program);
        if (gl.getError() === gl.NO_ERROR) {
          console.log('Successfully linked shader program ' + fileName + '.');
          // Shader program compilation successful:
          var effect = new Effect(program);
          callback(fileName, effect);
        }
        else {
          var infoLog = gl.getProgramInfoLog(program);
          callback(fileName, null);
          console.log('Could not link shader program ' + fileName + ':\n' + infoLog);
        }
      }
    };
    $.get(fileName, onGetShaderSource, 'text');
  };
    
  /**
   * Loads an image resource asynchronously 
   * @param {string} fileName Relative URL to file
   * @param {function(string, WebGLTexture)} callback Callback that is invoked as soon
   *  as the image has been loaded. The first argument is the URL and the
   *  second argument is the WebGL texture instance.
   */  
  var resourceImageLoader = function(fileName, callback) {
    var image = new Image();
    image.onload = function() {
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
      callback(fileName, texture);
    };
    image.src = fileName;
  };
  
  var resourceCubeMapLoader = function(fileName, callback) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    var faces = [["posx", gl.TEXTURE_CUBE_MAP_POSITIVE_X],
                 ["negx", gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
                 ["posy", gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
                 ["negy", gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
                 ["posz", gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
                 ["negz", gl.TEXTURE_CUBE_MAP_NEGATIVE_Z]];
    var texturesToLoad = 6;
    for (var i = 0; i < faces.length; i++) {
        var url = fileName.replace('<CubeMap>', faces[i][0]);
        var face = faces[i][1];
        var image = new Image();
        g_loadingImages.push(image);
        // Javascript has function, not block, scope.
        // See "JavaScript: The Good Parts", Chapter 4, "Functions",
        // section "Scope".
        image.onload = function(texture, face, image, url) {
          return function() {
            texturesToLoad--;
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            if (texturesToLoad === 0) {
              callback(fileName, texture);
            };
            
          };
        }(texture, face, image, url);
        image.src = url;
    }
  };
  
  
  /**
   * Loads a 3D model resource asynchronously 
   * @param {string} fileName Relative URL to file
   * @param {function(string, Model)} callback Callback that is invoked as soon
   *  as the model has been loaded. The first argument is the URL and the
   *  second argument is the created Model instance.  
   */  
  var resourceModelLoader = function(fileName, callback) {
    var onGetFile = function(data) {
      console.dir(data);
      var model = new Model();
      model.load(data);
      callback(fileName, model);
    };
    $.getJSON(fileName, onGetFile);
  };
  
  /**
   * Registers a resource loader in the specified resource manager for the
   * specified file extensions
   * @param resourceManager Resource loader will be registered for this resource
   *   manager.
   * @param {Array.<string>)} extensions File extensions that will be associated with
   *   this resource loader.
   * @param {function(fileName, function(string, object))} loaderFunc Resource
   *   loader function. The first argument is the URL relative to the base URL
   *   of the resource manager and the second argument is a callback function
   *   that has to be invoked by the resource loader function to pass the resource
   *   data as soon as it has been loaded.
   */
  var addLoader = function(resourceManager, extensions, loaderFunc) {
    $.each(extensions, function(index, extension) {
      resourceManager.loaders[extension.toLowerCase()] = loaderFunc;
    });
  };
  
  /**
   * Creates a new Resource instance
   * @param {string} fileName File name of resource 
   * @constructor
   * @classdesc Resource file that can be loaded by the resource manager  
   */  
  var Resource = function(fileName) {
    this.fileName = fileName;
    this.data = null;
    this.users = [];
  };
  
  Resource.prototype.addUser = function(component) {
    var inList = findFirstKey(this.users, component) !== null;
    if (inList === false) {
      this.users.push(component);
    }
  };
  
  /**
   * Creates a new ResourceManager instance
   * @param {string} baseURL Base URL that serves as path to resources  
   * @constructor
   * @classdesc Manages and loads the resources used by components   
   */   
  var ResourceManager = function(baseURL) {
    /**
     * Base URL that specifies the parent path of resources
     * @type {string} 
     */
    this.baseURL = baseURL;
    /**
     * Resources managed by this instance
     * @type {Object.<string, Resource>}
     */
    this.resources = {};
    /**
     * Holds the number of resources still to be loaded for each
     * component
     * @type {Object<Component, number>}
     */
    this.resourceCounters = {};
    /**
     * Registered resource loaders
     * @type {Object.<string, function(fileName, function(string, object))>}
     */
    this.loaders = {};
    addLoader(this, [ 'jpg', 'jpeg', 'png', 'gif' ], resourceImageLoader);
    addLoader(this, [ 'glsl'], resourceShaderLoader);
    addLoader(this, [ 'json'], resourceModelLoader);
    addLoader(this, [ 'jpg|cube', 'jpeg|cube', 'png|cube', 'gif|cube' ], resourceCubeMapLoader);
  };

  /**
   * Registers a resource loader in the specified resource manager for the
   * specified file extensions
   * @param resourceManager Resource loader will be registered for this resource
   *   manager.
   * @param {Array.<string>)} extensions File extensions that will be associated with
   *   this resource loader.
   * @param {function(fileName, function(string, object))} loaderFunc Resource
   *   loader function. The first argument is the URL relative to the base URL
   *   of the resource manager and the second argument is a callback function
   *   that has to be invoked by the resource loader function to pass the resource
   *   data as soon as it has been loaded.
   */
  ResourceManager.prototype.addLoader = function(extensions, loaderFunc) {
    addLoader(this, extensions, loaderFunc);
  };

  /**
   * Handles a loaded resource and informs fully loaded components 
   * @param {string} fileName URL of loaded resource
   * @param {Object} data Resource data 
   */
  ResourceManager.prototype.resourceLoaded = function(fileName, data) {
    // Assign loaded data to resource:
    fileName = fileName.substr(this.baseURL.length, fileName.length);
    var resource = this.resources[fileName];
    resource.data = data;

    // Check if users have been fully loaded:
    var rc = this.resourceCounters;
    $.each(resource.users, function(index, component) {
      rc[component] -= 1;
      if (rc[component] === 0) {
        // All resources of component have been loaded, so trigger its load
        // event:
        console.log('All resources of component have been loaded:');
        console.dir(component);
        component.loaded = true; // Component is loaded
        component.load();
        delete rc[component];
      }
    });
  };

  /**
   * Loads the specified resources for the component
   * @param {Component} component Component
   * @param {Array.<Resource>} resources Array with resources 
   */
  ResourceManager.prototype.loadResources = function(component, resources) {
    var that = this;
    that.resourceCounters[component] = resources.length;
    $.each(resources, function() {
      // Look up loader by file extension:
      var extension = (this.fileName.split(/\.([^\.]+)$/)[1] || '')
          .toLowerCase();
      var fileName = that.baseURL + this.fileName;
      var loader = that.loaders[extension];
      if (loader === undefined) {
        console.log('Cannot load resource %s. Unknown file extension %s'.sprintf(
            fileName,
          extension
        ));
      } else {
        // Invoke the resource loader:
        console.log('Loading ' + fileName + '...');
        loader(fileName, function(fileName, data) {
          // Use closure to keep <this>:
          that.resourceLoaded(fileName, data);
        });
      }
    });
  };

  /**
   * Loads the resources of the specified component
   * @param {Component} component Component
   */
  ResourceManager.prototype.add = function(component) {
    var resourcesToLoad = [];
    var res = this.resources;
    // Collect resources from component:
    $.each(component, function(name, value) {
      // Grab all Resource instances:
      if (this instanceof Resource) {
        // Look if resource is already registered:
        var resource = res[this.fileName];
        if (resource === undefined) {
          // Resource not registered yet, add to queue:
          resource = this;          
          res[resource.fileName] = resource;
          if (resource.data === null) {
            resourcesToLoad.push(resource);
          }
        } else {
          // Resource already registered, use existing request:
          component[name] = resource;
        }
        resource.addUser(component);
      }
    });
    this.loadResources(component, resourcesToLoad);
  };
  
  /**
   * Global resource manager
   */
  var resources = new ResourceManager('');
   
  /**
   * Defines the semantic role of a vertex attribute
   * @readonly
   * @enum {string}
   */
  var AttributeRole = {
    /**
     * Attribute has an unknown role.
     */
    'Unknown'   : '',
    /**
     * Attribute is a vertex position.
     */    
    'Position'  : 'p',
    /**
     * Attribute is a vertex normal.
     */    
    'Normal'    : 'n',
    /**
     * Attribute is a set of texture coordinates.
     */    
    'TexCoord'  : 't',
    /**
     * Attribute is a color.
     */    
    'Color'     : 'c',
    /**
     * Attribute is a tangent.
     */    
    'Tangent'   : 'tg',
    /**
     * Attribute is a bitangent.
     */    
    'BiTangent' : 'b'
  };
  
  /**
   * Attempts to find the semantic role of a vertex attribute based
   * on its name.
   * @param {object} info Info record returned by WebGL
   * @returns {AttributeRole} Guessed attribute role
   */
  var guessAttributeRole = function(info) {
    var format = /A(.+)/;
    var m = info.name.match(format);
    var name = m === null ? info.name : m[1];
    var role = AttributeRole[name] || AttributeRole.Unknown;
    console.log(info.name + ' is a ' + role + '.');
    return role;
  };
  
  /**
   * @constructor
   * @classdesc Exception that is thrown, when the specified vertex format
   *   string is invalid. 
   */
  var VertexFormatError = function(message) {
    this.toString = function() { return message; };
  }; 

  /**
   * @constructor
   * @classdesc Exception that is thrown, when the passed vertex data does not match
   *   the specified vertex format. 
   */
  var VertexDataError = function(message) {
    this.toString = function() { return message; };
  };
  
  var UnknownUniformError = function(message) {
    this.toString = function() { return message; };
  };  
  
  /**
   * Creates a new VertexFormat instance
   * @constructor
   * @classdesc Declares the layout of vertex attribute data
   * @param {string} format String that specifies the format of vertex
   *   attributes.
   */
  var VertexFormat = function(vertices, format) {
    /**
     * Defined vertex attributes
     * @type {Array.<object>}
     */
    this.attributes = [];
    /**
     * Vertex format string
     * @type {string}
     */
    this.format = format;
    /**
     * Total size of defined vertex attributes in number of floats
     */
    this.size = 0;
    
    var readBlock = function(blockFormat) {
      var pattern = /\s*([a-zA-Z]+)([0-9]+)(.*)/;
      var blockSize = 0;
      var attrs = [];
      while (blockFormat.length > 0) {
        m = blockFormat.match(pattern);
        if (m === null) {
          throw new VertexFormatError(
            'Vertex format string is invalid at position ' +
            format.length - expr.length);
          return
        }
        blockFormat = m[3];
        role = AttributeRole[findFirstKey(AttributeRole, m[1]) || AttributeRole.Unknown];
        size = parseInt(m[2]);
        blockSize += size;
        if (size < 1 || size > 16) {
          throw new VertexFormatError(
            'Vertex format string contains attribute with invalid size (' +
            m[1] + m[2] + ').');
        }
        if (role === AttributeRole.Unknown) {
          throw new VertexFormatError(
              'Vertex format string contains attribute with unknown role (' +
              m[1] + m[2] + ').');
        }
        attrs.push({role: role, size: size});
      }
      return {attrs: attrs, size: blockSize};
    };
    
    // Read blocks:
    var blockFormats = format.split('|');
    var blocks = [];
    for (var i = 0; i < blockFormats.length; i++) {
      var block = readBlock(blockFormats[i]);
      blocks.push(block);
      this.size += block.size;
    }
    
    if (vertices.length % this.size !== 0) {
      throw new VertexDataError('Length of vertices array does not match vertex format');
    }
    
    // Create attributes and calculate stride and offset:
    var vertexCount = vertices.length / this.size;
    var blockOffset = 0;
    var self = this;
    $.each(blocks, function() {
      var block = this;
      var offset = blockOffset;
      
      $.each(block.attrs, function() {
        self.attributes.push({
          role: this.role,
          size: this.size,
          stride: block.attrs.length > 1 ? block.size * 4 : 0,
          offset: offset});
        offset += this.size * 4;
      });
      blockOffset += block.size * vertexCount * 4;
    });
  };
  
  /**
   * Find the vertex attribute with the specified role
   * @param {AttributeRole} role Attribute role
   * @returns {Object=} The vertex attribute definition or null if no
   *   attribute with the specified role exists. 
   */
  VertexFormat.prototype.find = function(role) {
    var attrs = this.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      if (attr.role === role) {
        return attr;
      }
    }
    return null;
  };
  
  /**
   * Creates a new Mesh instance
   * @param {Float32Array} vertices Vertex data
   * @param {Uint16Array} indices Index data
   * @param {string} format Vertex format string
   * @param {number} primitive WebGL type of primitive
   * @param {boolean} calculateTangents If true, tangents are calculated and added to
   *   the vertex data. primtive has to be triangles and three-component positions and
   *   two-component texture coordinates need to be provided.
   * @constructor 
   * @classdesc Mesh that represents a sequence of primitives composed of
   *   vertices with a set of customizable attributes 
   */
  var Mesh = function(vertices, indices, format, primitive, calculateTangents) {
    /**
     * Derives number of primitives for the specified count of indices and type of primitive. 
     */
    var getPrimitiveCount = function(indexCount, primitive) {
      if (primitive === gl.TRIANGLES) {
        return indexCount / 3 >>> 0;
      }
      else if (primitive === gl.TRIANGLE_STRIP || primitive === gl.TRIANGLE_FAN) {
        return indexCount / 2 >>> 0;
      } 
      else if (primitive === gl.LINES) {
        return indexCount / 2 >>> 0;
      }
      else if (primitive === gl.LINE_STRIP || primitive === gl.LINE_LOOP) {
        return indexCount - 1;
      }
      else if (primitive === gl.POINTS) {
        return indexCount;
      }
      else {
        return 0;
      }
    };
    
    // Convert vertices and indices to Float32Array and Uint16Array:
    if (vertices instanceof Float32Array === false)
      vertices = new Float32Array(vertices);
    if (indices && indices instanceof Uint16Array === false)
      indices = new Uint16Array(indices);
    
    /**
     * Type of primitives to render
     * @type {number} 
     */    
    this.primitive = primitive || gl.TRIANGLES;
    /**
     * Format of vertex attributes
     * @type {VertexFormat}
     */
    this.vertexFormat = new VertexFormat(vertices, format);
    /**
     * Number of vertices in this mesh
     * @type {number}
     */
    this.vertexCount = vertices.length / this.vertexFormat.size;
    /**
     * {number} Number of indices in this mesh
     * @type {number}
     */
    this.indexCount = indices ? indices.length : this.vertexCount;
    /**
     * {number} Number of primitives defined in this mesh
     * @type {number}
     */
    this.primitiveCount = getPrimitiveCount(this.indexCount, this.primitive);
    
    if (calculateTangents === true) {
      vertices = this.calculateTangents(this, vertices, indices);
    }
    

    // Fill VBO and IBO:
    /**
     * Vertex buffer
     * @type {WebGLBuffer}
     */
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    /**
     * Index buffer
     * @type {WebGLBuffer}
     */
    this.ibo = null;
    if (indices) {
      this.ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }
  };
  
  /**
   * Calculates tangents for the specfied vertex and index data. Calculated
   * tangents are appended to the end of the vertex stream. The vertex data
   * needs to have position and texture coordinate attributes.
   * @param {Mesh} mesh Mesh that receives tangents
   * @param {Float32Array} vertices Vertex data
   * @param {Uint16Array} indices Index data
   */
  Mesh.prototype.calculateTangents = function(mesh, vertices, indices) {
    var posAttr = this.vertexFormat.find(AttributeRole.Position);
    var texAttr = this.vertexFormat.find(AttributeRole.TexCoord);
    // Triangles with XYZ position and XY texture coordinates needed: 
    if (this.primitive !== gl.TRIANGLES || 
        posAttr === null || posAttr.size !== 3 ||
        texAttr === null || texAttr.size !== 2) {
      return false;
    }    
        
    var pos = new Float32Array(9);
    var tex = new Float32Array(6);

    var pStride = posAttr.stride === 0 ? 3 : posAttr.stride / 4;
    var pOffset = posAttr.offset / 4;
    
    var tStride = posAttr.stride === 0 ? 2 : texAttr.stride / 4;
    var tOffset = texAttr.offset / 4;
    var q1 = new Float32Array(3);
    var q2 = new Float32Array(3);
    var u1 = new Float32Array(2); // s1, t1
    var u2 = new Float32Array(2); // s2, t2    
    
    var setQU = function(indices) {
      // Fetch position and texture coordinates for all 3 triangle vertices:
      for (var j = 0; j < 3; j++) {
        var vi = indices[j]; // Vertex index
        // Fetch vertex position X, Y & Z:
        for (var c = 0; c < 3; c++) {
          pos[j * 3 + c] = vertices[vi * pStride + pOffset + c];
        }
        // Fetch texture coordinates X & Y:
        for (var c = 0; c < 2; c++) {
          tex[j * 2 + c] = vertices[vi * tStride + tOffset + c];
        };
      }
      // Calculate difference vectors:
      for (var c = 0; c < 3; c++) {
        q1[c] = pos[c + 3] - pos[c];
        q2[c] = pos[c + 6] - pos[c];
      }
      u1[0] =  tex[5] - tex[1]; //  t2
      u1[1] = -tex[3] + tex[1]; // -t1
      u2[0] = -tex[4] + tex[0]; // -s2
      u2[1] =  tex[2] - tex[0]; //  s1
    };
    
    var t = vec3.create();
    var indexCount = mesh.indexCount;
    var tangents = new Float32Array(3 * mesh.vertexCount);
    var index = 0;
    
    var triIndices = new Uint16Array(3);
    while (index < indexCount) {
      // Set vertex indices of triangle:
      if (!indices) {
        for (var i = 0; i < 3; i++) {
          triIndices[i] = index + i;
        }
      }
      else {
        for (var i = 0; i < 3; i++) {
          triIndices[i] = indices[index + i];
        }
      }
      
      // Set position and texture coordinate difference vectors:
      setQU(triIndices);
      
      // Calculate tangent of triangle:
      var frac = 1.0 / (u1[0] * u2[1] - u2[0] * u1[1]);
      for (var i = 0; i < 3; i++) {
        t[i] = ((u1[0] * q1[i] + u1[1] * q2[i]) * frac);
      }
      vec3.normalize(t);
      
      // Accumulate triangle tangent to vertex tangents:
      for (var i = 0; i < 3; i++) {
        var vi = triIndices[i] * 3;
        tangents.set(t, vi);
      }
      index += 3;
    }
    // Normalize vertex tangents:
    for (var i = 0; i < mesh.vertexCount; i++) {
      vec3.normalize(tangents.subarray(i * 3, i * 3 + 3));
    }
    // Append tangents to vertices:
    var newVertices = new Float32Array(vertices.length + tangents.length);
    newVertices.set(vertices);
    newVertices.set(tangents, vertices.length);
    mesh.vertexFormat = new VertexFormat(
        newVertices,
        mesh.vertexFormat.format + '|' + AttributeRole.Tangent + '3');
    return newVertices;
  };
  
  /**
   * Draws the mesh with the specified effect
   * @param {Effect} effect Effect that is used for rendering the mesh 
   */
  Mesh.prototype.draw = function(effect) {
    effect.apply(); // Prepare effect for rendering
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    // ibo may be null, if no index buffer used:
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo); 
    
    // Assign portions of the vertex buffer to attribute index used by the effect:
    var attr = this.vertexFormat.attributes;
    //var stride = this.vertexFormat.size * 4; // Distance between consecutive attributes in Bytes
    
    //TODO: Improve disabling unused attribute slots:
    var count = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    for (var i = 0; i < count; i++) {
      gl.disableVertexAttribArray(i);
    }
    
    // Map effect attributes to attributes of vertex format:
    $.each(effect.attributes, function() {
      //var offset = 0;
      for (var i = 0; i < attr.length; i++) {
        // Search vertex format declaration for a fitting vertex attribute:  
        if (attr[i].role === this.role) {
          gl.enableVertexAttribArray(this.index);
          gl.vertexAttribPointer(
            this.index,
            attr[i].size,
            gl.FLOAT,
            false,
            attr[i].stride,
            attr[i].offset);
          break; 
        }
        //offset += attr[i].size * 4;
      }
    });
    
    if (this.ibo) {
      gl.drawElements(this.primitive, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
    else {
      gl.drawArrays(this.primitive, 0, this.indexCount);
    }
  };
  
  /**
   * Creates a new Model instance
   * @constructor 
   * @classdesc Represents a drawable 3D model composed of 3D meshes.
   */  
  var Model = function() {
    /**
     * Meshes of the model
     * @type {Mesh}
     */
    this.meshes = [];
  };
  
  /**
   * Loads a model from the specified JSON data.
   * @param {JSON} data JSON model data
   */
  Model.prototype.load = function(data)
  {
    // Resolves one to many mapping between vertex index and texture coordinates
    // by adding new vertices
    var resolveTexCoords = function(indices, positions, normals, texCoords) {
      var eps = 1e-5;
      texCoordMap = {};
      vertexCount = positions.length / 3;
      newTexCoords = new Array(vertexCount * 2);
      for (var i = 0; i < indices.length; i++) {
        var u = texCoords[i * 2];
        var v = texCoords[i * 2 + 1];        
        var vi = indices[i];
        var tc = texCoordMap[vi];
        if (tc === undefined) {
          // Map first texture coordinate to this vertex index:
          texCoordMap[vi] = [u, v];
          newTexCoords[vi * 2] = u;
          newTexCoords[vi * 2 + 1] = v;
        }
        else if (Math.abs(tc[0] - u) > eps || Math.abs(tc[1] - v) > eps) {
          // Texture coordinates mismatch, so duplicate vertex with
          // new texture coordinates:
          var nvi = positions.length / 3;
          var vi3 = vi * 3;
          positions.push(positions[vi3]);
          positions.push(positions[vi3 + 1]);
          positions.push(positions[vi3 + 2]);
          newTexCoords.push(u);
          newTexCoords.push(v);
          if (normals !== undefined) {
            normals.push(normals[vi3]);
            normals.push(normals[vi3 + 1]);
            normals.push(normals[vi3 + 2]);
          }
          indices[i] = nvi;
        }
      }
      return newTexCoords;
    };
    
    var self = this;
    $.each(data.objs, function() {
      var meshData = this.mesh;
      
      // Check mesh data content:
      var hasNormals = meshData.n !== undefined;
      var hasTexCoords = (meshData.uv !== undefined) &&
        (meshData.uv.length > 0);
      
      // Calculate vertex format:
      var size = 3 + (hasNormals ? 3 : 0) +
          (hasTexCoords ? 2 : 0);
      var format = AttributeRole.Position + '3' +
      (hasNormals ? '|' + AttributeRole.Normal + '3' : '') +
      (hasTexCoords ? '|' + AttributeRole.TexCoord + '2' : '');
      var indices = meshData.f;
      var positions = meshData.v;
      var normals = meshData.n;
      var texCoords = hasTexCoords ? meshData.uv[0] : undefined;
      
      if (hasTexCoords) {
        texCoords = resolveTexCoords(indices, positions, normals, texCoords);
      }
      
      var indexCount = indices.length;
      var vertexCount = positions.length / 3;
      var vertices = new Float32Array(vertexCount * size);
      var offset = 0;
      vertices.set(positions, offset);
      offset += vertexCount * 3;
      if (hasNormals) {
        vertices.set(normals, offset);
        offset += vertexCount * 3;
      }
      if (hasTexCoords) {
        vertices.set(texCoords, offset);
        offset += vertexCount * 2;
      }
      var mesh = new Mesh(vertices, indices, format, gl.TRIANGLES, true);
      self.meshes.push(mesh);
    });
  };
  
  Model.prototype.draw = function(effect) {
    var count = this.meshes.length;
    for (var i = 0; i < count; i++) {
      this.meshes[i].draw(effect);
    }
  };
  

  /**
   * Creates a new Effect instance
   * @param {WebGLProgram} program Shader program object returned by WebGL
   * @constructor 
   * @classdesc Manages a shader program that can be used to draw meshes
   */
  var Effect = function(program) {
    /**
     * Compiled shader program 
     * @type {WebGLProgram}
     */
    this.program = program;
   
    /**
     * Uniform variables used by shader
     * @type {Array.<Object>} 
     */
    this.uniforms = {};    
    var uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    var texUnit = 0;
    for (var i = 0; i < uniformCount; i++) {
      var info = gl.getActiveUniform(program, i);
      var loc = gl.getUniformLocation(program, info.name);
      var value = gl.getUniform(program, loc);
      var data = {
          name: info.name,
          size: info.size,
          type: info.type,
          setter: getUniformSetFunc(info.size, info.type),
          value: value,
          needsSet: false
          };
      // Map samplers to texture unit for later use:
      if (info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_CUBE) {
        data.texUnit = texUnit;
        texUnit++;
      }
      this.uniforms[info.name] = data;
    }
    console.dir(this.uniforms);
    
    /**
     * Named vertex attributes used by shader
     * @type {Array.<Object>}
     */
    this.attributes = {};    
    var attribCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (var i = 0; i < attribCount; i++) {
      var info = gl.getActiveAttrib(program, i);
      var loc = gl.getAttribLocation(program, info.name);
      console.log('getAttribLocation for ' + info.name + ' returns ' + loc);
      var data = {
          name: info.name,
          size: info.size,
          type: info.type,
          index: loc,
          role: guessAttributeRole(info)
          };
      this.attributes[info.name] = data;
    }
    console.dir(this.attributes);
  };
  
  /**
   * Gets or sets a uniform variable. If only name is specified then
   * the value of the specified uniform variable is returned.
   * @param {string} name Name of the uniform variable
   * @param {any=} value Optional value to set
   * @param {boolean=} ignoreError Specifies if errors will be thrown
   *   as exception or ignored.
   * @returns {any=} Value of specified uniform or null if an error
   *   occured and ignoreError was set to true.
   */
  Effect.prototype.uniform = function(name, value, ignoreError) {
    var u = this.uniforms[name];
    if (!u) {
      if (ignoreError === true) {
        return null;
      }
      else {
        throw new UnknownUniformError('Unknown uniform variable "' + name + '".');
      }
    } 
    if (value === undefined) {
      return u.value;
    } else {
      u.needsSet = true;
      u.value = value;
      return value;
    }
  };
  
  Effect.prototype.apply = function() {
    gl.useProgram(this.program);
    // Upload uniform values:
    var self = this;
    $.each(this.uniforms, function() {
      if (this.texUnit !== undefined) {
        var unit = gl.TEXTURE0 + this.texUnit;
        gl.activeTexture(unit);
        gl.bindTexture(gl.TEXTURE_2D, this.value);
        var location = gl.getUniformLocation(self.program, this.name);
        this.setter(location, this.texUnit);
      }
      else if (this.needsSet) {
        var location = gl.getUniformLocation(self.program, this.name);
        this.setter(location, this.value);
        this.needsSet = false;
      }
    });
  };
  
  /**
   * Creates a new CameraView instance 
   * @constructor 
   * @classdesc Stores the camera view and projection parameters
   */
  var CameraView = function() {
    /**
     * Vertical field-of-view angle in degrees
     * @type {number}
     */
    this.fieldOfView = 90.0;
    /**
     * Near clipping plane
     * @type {number}
     */
    this.nearClip = 0.01;
    /**
     * Far clipping plane
     * @type {number}
     */
    this.farClip = 100.0;
    /**
     * Camera position in world coordinates
     * @type {vec3}
     */
    this.position = vec3.create([0, 0, 0]);
    /**
     * Camera view direction in world coordinates
     * @type {vec3}
     */
    this.viewDir = vec3.create([0, 0, 1]);
    /**
     * Projection matrix
     * @type {mat4}
     */
    this.projection = mat4.perspective(
        this.fieldOfView,
        canvasAspectRatio,
        this.nearClip,
        this.farClip);
    /**
     * View matrix
     * @type {mat4}
     */
    this.view = gm.mat4.identity();
    /** Inverse view matrix
     * @type {mat4} 
     */
    this.inverseView = gm.mat4.identity();
  };

  /**
   * Recalculates the projection matrix using the internal camera
   * parameters.
   */
  CameraView.prototype.updateProjection = function() {
    this.projection = mat4.perspective(
      this.fieldOfView,
      canvasAspectRatio,
      this.nearClip,
      this.farClip);
  };
  
  /**
   * Sets the camera projection matrix
   * @param fieldOfView Vertical field-of-view angle in degrees
   * @param nearClip Near clipping plane distance
   * @param farClip Far clipping plane distance
   */
  CameraView.prototype.setProjection = function(fieldOfView, nearClip, farClip) {
    this.projection = mat4.perspective(
      fieldOfView,
      canvasAspectRatio,
      nearClip,
      farClip);
  };
  
  /**
   * Sets the vertical field of view
   * @param {number} fieldOfViewY Vertical field of view angle
   *   in degrees
   */
  CameraView.prototype.setFieldOfView = function(fieldOfViewY) {
    this.fieldOfView = fieldOfViewY;
    this.updateProjection();
  };
  
  /**
   * Sets the near and far clipping planes
   * @param {number} nearClip Near clipping plane
   * @param {number} farClip Far clipping plane
   */
  CameraView.prototype.setClip = function(nearClip, farClip) {
    this.nearClip = nearClip;
    this.farClip = farClip;
    this.updateProjection();
  };
  
  /**
   * Sets the camera view matrix
   * @param {mat4} view View matrix
   */
  CameraView.prototype.setView = function(view) {
    this.view = view;
    mat4.inverse(view, this.inverseView);
    var iv = this.inverseView;
    this.position = vec3.create([iv[12], iv[13], iv[14]]);
    var v = this.view;
    this.viewDir = vec3.create([v[2], v[6], v[10]]);
  };
  
  var Timing = function() {
    /**
     * Passed time in seconds since the creation of this object
     * @type {number}
     */
    this.time = 0.0;
    /**
     * Number of total rendered frames
     * @type {number}
     */    
    this.frameCount = 0;
    /**
     * Number of frames to use for frame rate measurement
     * @type {number}
     */    
    this.frameWindowSize = 5;
    /**
     * Frame rate in frames per second
     * @type {number}
     */    
    this.fps = 0.0;
    /**
     * Start time in seconds at the creation of this object
     * @type {number}
     */    
    this.startTime = (new Date).getTime();
    /**
     * Start time of a new frame window for frame rate measurement
     * @type {number}
     */    
    this.frameWindowTime = this.startTime;    
  };
  
  Timing.prototype.nextFrame = function() {
    var now = (new Date).getTime();
    this.time = (now - this.startTime) / 1000.0;
    this.frameCount++;
    if (this.frameCount % this.frameWindowSize === 0) {
      var seconds = (now - this.frameWindowTime) / 1000.0;
      this.fps = Math.round(this.frameWindowSize / seconds);
      this.frameWindowTime = now;
    }
  };

  /**
   * Creates a new Scene instance
   * @constructor 
   * @classdesc Represents a scene with a set of drawable components. 
   */  
  var Scene = function() {
    /**
     * Provides camera view and projection parameters that can
     * be read and modified.
     * @type {CameraView}
     */
    this.cameraView = new CameraView();
    /**
     * Timing instance that provides information on passed time
     * and frame rate measurement
     * @type {Timing}
     */
    this.timing = new Timing();
    /**
     * Components used by this Scene instance
     * @type {Array.<Component>}
     */
    this.components = [];
    /**
     * Resource manager used by this Scene instance
     * @type {ResourceManager}
     */
    this.resources = resources;
  };
  
  /**
   * Adds the specified component to this scene
   * @param {Component} component Component to add
   */
  Scene.prototype.add = function(component) {
    component.scene = this;
    this.components.push(component);
    // Register component in resource manager:
    this.resources.add(component);
  };

  /**
   * Draws all visible scene components
   */
  Scene.prototype.draw = function() {
    // Perform drawing:
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    $.each(this.components, function() {
      if (this.loaded && this.visible) {
        this.draw();
      }
    });   
  };

  /**
   * Updates all enabled scene components
   */
  Scene.prototype.update = function() {
    $.each(this.components, function() {
      if (this.loaded && this.enabled) {
        this.update();
      }
    });
  };
  
  /**
   * Executes the render loop, which will periodically
   * update and draw components each frame. 
   */
  Scene.prototype.renderLoop = function() {
    var self = this;
    var loopFunc = function() {
      reshapeViewport();
      self.cameraView.updateProjection();
      self.update();
      self.draw();
      requestAnimFrame(loopFunc);
      self.timing.nextFrame();
    };
    loopFunc();
  };

  /**
   * Creates a new Component instance 
   * @constructor 
   * @classdesc Drawable component that can be added to a scene.
   *   The bahviour of a component can be modified by implementing
   *   its draw and update method.
   */
  var Component = function() {
    this.scene = null;
    this.world = gm.mat4.identity();
    this.loaded = false;
    this.visible = true;
    this.enabled = true;
  };

  Component.prototype.load = function() {
    console.log('Component loaded.');
  };
  
  /**
   * Prepares the specified effect for rendering. This method
   * will set the standard transform matrices World, View,
   * Projection and WorldViewProjection as well as CameraPosition if
   * they are used by the effect.  
   * @param {Effect} effect Effect that is used for drawing
   */
  Component.prototype.useEffect = function(effect) {
    var w = this.world;
    var cv = this.scene.cameraView;
    var v = cv.view;
    var p = cv.projection;
    effect.uniform('World', w, true);
    effect.uniform('View', v, true);
    effect.uniform('Projection', p, true);
    
    // Product of World, View and Projection:
    var wvp = mat4.identity();
    mat4.multiply(p, v, wvp);
    mat4.multiply(wvp, w, wvp);
    effect.uniform('WorldViewProjection', wvp, true);
    
    // Camera position:
    effect.uniform('CameraPosition', cv.position, true);
  };

  /**
   * Draws the component. This method is invoked in each render loop 
   * iteration of the parent scene.
   */
  Component.prototype.draw = function() {
  };

  /**
   * Updates the component. This method is invoked in each render loop 
   * iteration of the parent scene.
   */
  Component.prototype.update = function() {
  };
  
  return {
    Effect : Effect,
    Resource : Resource,
    Scene : Scene,
    Component : Component,
    VertexFormat : VertexFormat,
    Mesh : Mesh,
    Model : Model,
    resources : resources,
    createGLContext : createGLContext,
  };
});