gloomy
======

A small Javascript library for simplifying WebGL

Features
--------

Gloomy is intented to make your WebGL life easier by
assisting you with the following features:

* Component-based scene management, where drawable objects can be
  added and removed as well as shown or hidden.

* Declare a resource like an texture, mesh or effect in a scene component and
  gloomy loads them in the background and renders the component as soon as all 
  resources of the component have been loaded.
  
* Resources may be shared between components.

* Declare a vertex format by string ("p3n3t2"), pass vertex and index data and
  gloomy creates a mesh with underlying vertex and index buffers for you.
  
* gloomy manages vertex and fragment shaders as effects that can be loaded from
  a single file

* Meshes can be easily rendererd with custom effects, because vertex attributes
  and standard uniforms ("View", "Projection", ...) are automatically assigned.
  
Current state
-------------

gloomy is still in an early state of development. Alhtough most of the
described features already work, the interface is subject to change.
