/** Track relative movement on a fixed wheel hit area; touching never changes steering. */
export class SteeringGesture {
  static readonly maxAngle = 135;
  public angle = 0;
  private pointerId: number | null = null;
  private previousX = 0;
  private radius = 1;

  public begin(pointerId: number, x: number, _y: number, radius: number): boolean {
    if (this.pointerId !== null) return false;
    this.pointerId = pointerId;
    this.radius = Math.max(1, radius);
    this.previousX = x;
    return true;
  }

  public move(pointerId: number, x: number, _y: number): number | null {
    if (this.pointerId !== pointerId) return null;
    // Screen-space dragging must keep the same direction on every part of the wheel.
    // Angular dragging reverses horizontal input when the finger is below the hub.
    this.angle += (x - this.previousX) / this.radius * SteeringGesture.maxAngle;
    this.previousX = x;
    this.angle = Math.max(-SteeringGesture.maxAngle, Math.min(SteeringGesture.maxAngle, this.angle));
    return this.angle;
  }

  public end(pointerId: number): boolean {
    if (this.pointerId !== pointerId) return false;
    this.reset();
    return true;
  }

  public reset() {
    this.pointerId = null;
    this.angle = 0;
  }
}
