#version 420

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 vert_normal;
uniform mat4 modelViewProjectionMatrix;

out vec3 frag_normal;

void main()
{
	gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);
	frag_normal = vert_normal;
}
