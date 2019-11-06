#version 420

layout(location = 0) in vec3 position;
layout(location = 1) in vec2 uvs;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;

// >>> @task 3.2
out vec3 outColor;

void main()
{
	vec4 pos = vec4(position.xyz - cameraPosition.xyz, 1);
	gl_Position = projectionMatrix * pos;

	// >>> @task 3.3
	outColor = vec3(uvs, 0);
}