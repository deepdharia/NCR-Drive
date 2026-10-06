/** Track relative movement on a fixed wheel hit area; touching never changes steering. */
export class SteeringGesture {
  static readonly maxAngle = 135;
  public angle = 0;
  private pointerId: number | null = null;
  private previousPolar = 0;
  private previousX = 0;
  private horizontal = false;
  private radius = 1;

  public begin(pointerId: number, x: number, y: number, radius: number): boolean {
    if (this.pointerId !== null) return false;
    this.pointerId = pointerId;
    this.radius = Math.max(1, radius);
    this.previousPolar = Math.atan2(y, x);
    this.previousX = x;
    this.horizontal = Math.hypot(x, y) < this.radius * .3;
    return true;
  }

  public move(pointerId: number, x: number, y: number): number | null {
    if (this.pointerId !== pointerId) return null;
    if (this.horizontal) {
      this.angle += (x - this.previousX) / this.radius * SteeringGesture.maxAngle;
      this.previousX = x;
    } else if (Math.hypot(x, y) >= this.radius * .15) {
      const polar = Math.atan2(y, x);
      // Shortest arc prevents a jump when crossing atan2's -PI/PI seam.
      const delta = Math.atan2(Math.sin(polar - this.previousPolar), Math.cos(polar - this.previousPolar));
      this.angle += delta * 180 / Math.PI;
      this.previousPolar = polar;
    }
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
