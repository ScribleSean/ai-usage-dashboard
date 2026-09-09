import AppKit
import Foundation

let arguments = CommandLine.arguments
guard arguments.count == 3, let mark = NSImage(contentsOfFile: arguments[1]), mark.isValid else {
    fatalError("Canonical telescope SVG could not be read")
}
let folder = URL(fileURLWithPath: arguments[2])
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
              let context = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("Icon context unavailable") }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        context.imageInterpolation = .high
        let side = CGFloat(pixels)
        NSColor(calibratedRed: 9/255, green: 9/255, blue: 11/255, alpha: 1).setFill()
        NSBezierPath(roundedRect: NSRect(x: side * 0.04, y: side * 0.04, width: side * 0.92, height: side * 0.92),
                     xRadius: side * 0.2, yRadius: side * 0.2).fill()
        mark.draw(in: NSRect(x: side * 0.19, y: side * 0.19, width: side * 0.62, height: side * 0.62))
        NSGraphicsContext.restoreGraphicsState()
        guard let data = bitmap.representation(using: .png, properties: [:]) else { fatalError("Icon encoding failed") }
        let name = "icon_\(size)x\(size)\(scale == 2 ? "@2x" : "").png"
        try data.write(to: folder.appendingPathComponent(name))
    }
}
print("Native icons generated from canonical telescope SVG")
