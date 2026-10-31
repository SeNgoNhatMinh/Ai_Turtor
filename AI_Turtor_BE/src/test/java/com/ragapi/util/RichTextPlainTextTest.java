package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RichTextPlainTextTest {

    @Test
    void decodesAngleBracketsTypedInTheEditor() {
        assertThat(RichTextPlainText.toPlain("Directive &lt;%@ page contentType=\"text/html\" %&gt;"))
                .isEqualTo("Directive <%@ page contentType=\"text/html\" %>");
        assertThat(RichTextPlainText.toPlain("<p>So sánh a &lt; b và b &gt; c</p>"))
                .isEqualTo("So sánh a < b và b > c");
    }

    @Test
    void keepsPlainCodeAnglesThatAreNotEditorMarkup() {
        assertThat(RichTextPlainText.toPlain("use <div> tag"))
                .isEqualTo("use <div> tag");
    }

    @Test
    void secondPassDoesNotStripDecodedAngles() {
        String once = RichTextPlainText.toPlain("<div>Directive &lt;%@ include %&gt;</div>");
        assertThat(once).isEqualTo("Directive <%@ include %>");
        assertThat(RichTextPlainText.toPlain(once)).isEqualTo(once);
    }
}
