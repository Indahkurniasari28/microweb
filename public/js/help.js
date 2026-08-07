// =======================================
// MICROWAT HELP CENTER
// =======================================

document.addEventListener("DOMContentLoaded", () => {

    // ==============================
    // FAQ SEARCH
    // ==============================

    const search = document.getElementById("faqSearch");
    const faqItems = document.querySelectorAll(".faq-item");

    if (search) {

        search.addEventListener("keyup", function () {

            const keyword = this.value.toLowerCase();

            faqItems.forEach(item => {

                const question = item.querySelector("summary").textContent.toLowerCase();
                const answer = item.querySelector("p").textContent.toLowerCase();

                if (
                    question.includes(keyword) ||
                    answer.includes(keyword)
                ) {

                    item.style.display = "block";

                } else {

                    item.style.display = "none";

                }

            });

        });

    }

    // ==============================
    // FAQ ACCORDION
    // ==============================

    faqItems.forEach(item => {

        item.addEventListener("toggle", function () {

            if (this.open) {

                faqItems.forEach(other => {

                    if (other !== this) {

                        other.open = false;

                    }

                });

            }

        });

    });

    // ==============================
    // FORM
    // ==============================

    const form = document.getElementById("helpForm");

    if (form) {

        form.addEventListener("submit", function (e) {

            e.preventDefault();

            const fullName = document.getElementById("fullName").value.trim();
            const email = document.getElementById("email").value.trim();
            const subject = document.getElementById("subject").value.trim();
            const message = document.getElementById("message").value.trim();

            if (
                fullName === "" ||
                email === "" ||
                subject === "" ||
                message === ""
            ) {

                alert("Please complete all required fields.");

                return;

            }

            const ticket =
                "MIC-" +
                new Date().getFullYear() +
                "-" +
                Math.floor(Math.random() * 9000 + 1000);

            alert(
`Support request submitted successfully!

Ticket ID : ${ticket}

Our team will respond within 24 hours.`
            );

            form.reset();

            if(document.getElementById("preview")){
                document.getElementById("preview").style.display="none";
            }

        });

    }

    // ==============================
    // IMAGE PREVIEW
    // ==============================

    const fileInput = document.querySelector('input[type="file"]');

    if(fileInput){

        const preview = document.createElement("img");

        preview.id="preview";

        preview.style.maxWidth="250px";
        preview.style.marginTop="15px";
        preview.style.borderRadius="16px";
        preview.style.display="none";

        fileInput.parentElement.appendChild(preview);

        fileInput.addEventListener("change",function(){

            const file=this.files[0];

            if(file){

                preview.src=URL.createObjectURL(file);

                preview.style.display="block";

            }

        });

    }

});