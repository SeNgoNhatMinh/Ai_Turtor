import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.rendering.PDFRenderer;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class GenerateDemoPdf {
    private static final PDType1Font TITLE = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private static final PDType1Font BODY = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDType1Font BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private static final float LEFT = 54;
    private static final float WIDTH = 504;

    public static void main(String[] args) throws Exception {
        Path output = Path.of("output/pdf/PRJ301-demo-learning-material.pdf");
        Path renderDir = Path.of("tmp/pdfs");
        Files.createDirectories(output.getParent());
        Files.createDirectories(renderDir);

        try (PDDocument document = new PDDocument()) {
            addPage(document, "PRJ301 Demo Learning Material", List.of(
                    section("1. Java Server Pages (JSP)"),
                    paragraph("JSP is a server-side view technology for Java web applications. A JSP page combines static HTML with JSP tags and Expression Language. The web container translates the JSP file into a servlet class, compiles it, creates the servlet instance, and executes it to generate an HTTP response."),
                    section("JSP request lifecycle"),
                    bullet("Translation: the container converts the JSP source into Java servlet source code."),
                    bullet("Compilation: the generated servlet source is compiled into bytecode."),
                    bullet("Initialization: jspInit() runs once when the JSP servlet is initialized."),
                    bullet("Request processing: _jspService() runs for every request and writes the response."),
                    bullet("Destruction: jspDestroy() runs before the servlet is removed."),
                    section("2. Spring Boot"),
                    paragraph("Spring Boot helps developers create Spring applications quickly through auto-configuration, starter dependencies, embedded servers, and production-ready conventions. A typical REST application uses @RestController for HTTP endpoints, @Service for business rules, and repository components for persistence."),
                    bullet("Auto-configuration selects beans based on dependencies and configuration."),
                    bullet("Starter dependencies provide compatible libraries for common use cases."),
                    bullet("Embedded Tomcat allows the application to run as a standalone JAR.")
            ));
            addPage(document, "PRJ301 Review Notes", List.of(
                    section("3. Spring MVC request flow"),
                    paragraph("A request first reaches DispatcherServlet. It selects a controller through handler mappings. The controller validates input and calls a service. The service applies business logic and may call a repository. The controller then returns a view or a serialized response body."),
                    section("4. Layered architecture"),
                    bullet("Controller: HTTP input, validation boundary, and response status."),
                    bullet("Service: business rules and transaction-oriented operations."),
                    bullet("Repository: database access and persistence queries."),
                    bullet("DTO: stable request and response contracts between frontend and backend."),
                    section("5. Demo questions"),
                    bullet("What happens the first time a JSP page is requested?"),
                    bullet("Why does Spring Boot use starter dependencies?"),
                    bullet("What is the role of DispatcherServlet in Spring MVC?"),
                    section("Expected learning outcome"),
                    paragraph("Students should be able to explain the JSP lifecycle, identify the responsibilities of controller-service-repository layers, and describe the Spring MVC request flow without exposing personal or confidential information to external AI providers.")
            ));
            document.save(output.toFile());
        }

        try (PDDocument document = Loader.loadPDF(output.toFile())) {
            PDFRenderer renderer = new PDFRenderer(document);
            for (int i = 0; i < document.getNumberOfPages(); i++) {
                ImageIO.write(renderer.renderImageWithDPI(i, 130), "png",
                        renderDir.resolve("PRJ301-demo-page-" + (i + 1) + ".png").toFile());
            }
        }
        System.out.println(output.toAbsolutePath());
    }

    private static void addPage(PDDocument document, String heading, List<Block> blocks) throws Exception {
        PDPage page = new PDPage(PDRectangle.A4);
        document.addPage(page);
        try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
            cs.setNonStrokingColor(Color.WHITE);
            cs.addRect(0, 0, PDRectangle.A4.getWidth(), PDRectangle.A4.getHeight());
            cs.fill();
            cs.setNonStrokingColor(new Color(31, 78, 121));
            cs.addRect(0, 775, PDRectangle.A4.getWidth(), 67);
            cs.fill();
            write(cs, TITLE, 21, Color.WHITE, LEFT, 803, heading);
            write(cs, BODY, 9, new Color(220, 235, 248), LEFT, 786,
                    "AI Tutor education demo | Course PRJ301 | Safe synthetic material");

            float y = 744;
            for (Block block : blocks) {
                if (block.section) {
                    y -= 8;
                    write(cs, BOLD, 14, new Color(31, 78, 121), LEFT, y, block.text);
                    y -= 23;
                } else {
                    String prefix = block.bullet ? "- " : "";
                    List<String> lines = wrap(prefix + block.text, block.bullet ? 91 : 96);
                    for (String line : lines) {
                        write(cs, BODY, 10.5f, new Color(35, 35, 35), LEFT + (block.bullet ? 8 : 0), y, line);
                        y -= 15;
                    }
                    y -= block.bullet ? 3 : 8;
                }
            }
            cs.setStrokingColor(new Color(190, 205, 220));
            cs.moveTo(LEFT, 42);
            cs.lineTo(LEFT + WIDTH, 42);
            cs.stroke();
            write(cs, BODY, 8, new Color(90, 100, 110), LEFT, 28,
                    "Demo data only. No real student identity, score, email, phone, token, or credential.");
        }
    }

    private static void write(PDPageContentStream cs, PDType1Font font, float size, Color color,
                              float x, float y, String text) throws Exception {
        cs.beginText();
        cs.setFont(font, size);
        cs.setNonStrokingColor(color);
        cs.newLineAtOffset(x, y);
        cs.showText(text);
        cs.endText();
    }

    private static List<String> wrap(String text, int maxChars) {
        List<String> lines = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String word : text.split("\\s+")) {
            if (current.length() > 0 && current.length() + word.length() + 1 > maxChars) {
                lines.add(current.toString());
                current.setLength(0);
            }
            if (current.length() > 0) current.append(' ');
            current.append(word);
        }
        if (current.length() > 0) lines.add(current.toString());
        return lines;
    }

    private static Block section(String text) { return new Block(text, true, false); }
    private static Block paragraph(String text) { return new Block(text, false, false); }
    private static Block bullet(String text) { return new Block(text, false, true); }
    private record Block(String text, boolean section, boolean bullet) {}
}
