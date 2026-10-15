class_name VehicleInteractArea
extends Area3D

@export var exit_speed_limit_kmh: float = 15.0
@onready var car: CarController = get_parent() as CarController
@onready var exit_marker: Marker3D = $"../DriverDoorMarker"
var nearby_player: PlayerController = null
var driver: PlayerController = null

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

func _on_body_entered(body: Node3D) -> void:
	if body is PlayerController and body.is_in_group("player"):
		nearby_player = body as PlayerController

func _on_body_exited(body: Node3D) -> void:
	if body == nearby_player:
		nearby_player = null

func _unhandled_input(event: InputEvent) -> void:
	if not event.is_action_pressed("interact") or event.is_echo():
		return
	if is_instance_valid(driver):
		get_viewport().set_input_as_handled()
		if car.speed_kmh() < exit_speed_limit_kmh:
			try_exit()
	elif is_instance_valid(nearby_player) and nearby_player.player_active:
		get_viewport().set_input_as_handled()
		driver = nearby_player
		driver.set_player_active(false)
		car.set_driving(true)

func try_exit() -> bool:
	# Keep the capsule upright even when the car is parked on a ramp.
	var exit_transform: Transform3D = Transform3D(Basis.IDENTITY, exit_marker.global_position)
	var query: PhysicsShapeQueryParameters3D = PhysicsShapeQueryParameters3D.new()
	query.shape = driver.collider.shape
	query.transform = exit_transform * driver.collider.transform
	query.collision_mask = driver.saved_mask
	query.exclude = [driver.get_rid()]
	if not get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty():
		return false
	car.set_driving(false)
	driver.global_transform = exit_transform
	driver.set_player_active(true)
	driver = null
	return true
