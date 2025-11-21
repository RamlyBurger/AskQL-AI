
document.addEventListener("DOMContentLoaded", () => {
    // --- IntersectionObserver for Scroll Animations ---
    const animatedElements =
        document.querySelectorAll(".animate-on-scroll");
    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        // observer.unobserve(entry.target); // Optional: unobserve after first time
                    } else {
                        entry.target.classList.remove("is-visible"); // Reverse on scroll up
                    }
                });
            },
            {
                rootMargin: "0px 0px -50px 0px",
            }
        );
        animatedElements.forEach((el) => observer.observe(el));
    } else {
        animatedElements.forEach((el) => el.classList.add("is-visible"));
    }

    // --- D3.js Interactive Bar Chart ---
    (function createChart() {
        const data = [
            { month: "Jan", sales: 1200 },
            { month: "Feb", sales: 1500 },
            { month: "Mar", sales: 2100 },
            { month: "Apr", sales: 1800 },
            { month: "May", sales: 2400 },
            { month: "Jun", sales: 3000 },
            { month: "Jul", sales: 2700 },
            { month: "Aug", sales: 3100 },
        ];
        const container = d3.select("#interactive-chart");
        if (container.empty()) return; // Don't run if chart element isn't there

        const tooltip = d3.select(".chart-tooltip");
        const margin = { top: 20, right: 20, bottom: 50, left: 60 };
        const chartWidth =
            parseInt(container.style("width")) - margin.left - margin.right;
        const chartHeight = 400 - margin.top - margin.bottom;

        const svg = container
            .attr(
                "viewBox",
                `0 0 ${chartWidth + margin.left + margin.right} ${chartHeight + margin.top + margin.bottom
                }`
            )
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3
            .scaleBand()
            .domain(data.map((d) => d.month))
            .range([0, chartWidth])
            .padding(0.3);

        const y = d3
            .scaleLinear()
            .domain([0, d3.max(data, (d) => d.sales) * 1.1])
            .range([chartHeight, 0]);

        svg
            .append("g")
            .attr("transform", `translate(0, ${chartHeight})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("class", "axis-text");

        svg
            .append("g")
            .call(
                d3
                    .axisLeft(y)
                    .ticks(5)
                    .tickFormat((d) => `$${d / 1000}k`)
            )
            .selectAll("text")
            .attr("class", "axis-text");

        svg.selectAll(".domain").attr("class", "axis-path");
        svg.selectAll(".tick line").attr("class", "axis-line");

        svg
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left)
            .attr("x", 0 - chartHeight / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .attr("class", "axis-text")
            .style("font-size", "14px")
            .style("fill", "#6b7280")
            .text("Sales (USD)");

        svg
            .selectAll(".chart-bar")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "chart-bar")
            .attr("x", (d) => x(d.month))
            .attr("width", x.bandwidth())
            .attr("fill", "#2563eb")
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("y", chartHeight)
            .attr("height", 0)
            .on("mouseover", function (event, d) {
                d3.select(this).style("fill", "#1d4ed8");
                tooltip
                    .style("opacity", 1)
                    .html(
                        `<strong>${d.month
                        } Sales</strong><br>$${d.sales.toLocaleString()}`
                    );
            })
            .on("mousemove", function (event) {
                const [mouseX, mouseY] = d3.pointer(
                    event,
                    d3.select("body").node()
                );
                tooltip
                    .style("left", mouseX + 15 + "px")
                    .style("top", mouseY - 30 + "px")
                    .style("transform", "translateY(0)");
            })
            .on("mouseout", function () {
                d3.select(this).style("fill", "#2563eb");
                tooltip
                    .style("opacity", 0)
                    .style("transform", "translateY(10px)");
            })
            .transition()
            .duration(800)
            .delay((d, i) => i * 100)
            .attr("y", (d) => y(d.sales))
            .attr("height", (d) => chartHeight - y(d.sales));
    })();

    // --- NEW: JS-based Badge Glow Animation ---
    (function animateBadgeGlow() {
        const container = document.getElementById("badge-light-container");
        const blob = document.getElementById("badge-light-blob");

        if (!container || !blob) return;

        // Function to start animation
        function startAnimation() {
            const width = container.offsetWidth;
            const height = container.offsetHeight;

            // Use offsetWidth/Height which are integers.
            // If they are 0, it means the element isn't rendered yet.
            if (width === 0 || height === 0) {
                // Try again after a short delay if element isn't sized
                setTimeout(startAnimation, 100);
                return;
            }

            const rx = width / 2; // x-radius of ellipse
            const ry = height / 2; // y-radius of ellipse
            const cx = width / 2; // center x
            const cy = height / 2; // center y

            let startTime = null;
            const duration = 6000; // 6 seconds for one orbit

            function step(timestamp) {
                if (!startTime) startTime = timestamp;
                const elapsed = timestamp - startTime;
                const progress = (elapsed % duration) / duration; // 0 to 1 loop

                const angle = progress * 2 * Math.PI; // Full circle

                // Calculate position on the ellipse
                const x = cx + rx * Math.cos(angle);
                const y = cy + ry * Math.sin(angle);

                // Update blob position
                blob.style.left = `${x}px`;
                blob.style.top = `${y}px`;

                requestAnimationFrame(step);
            }

            requestAnimationFrame(step);
        }

        startAnimation();
    })();

    // --- NEW: Typewriter Effect for Floating Chat ---
    (function typeEffect() {
        const placeholderText =
            "Ask the AI agent anything... (Type @ to mention datasets)";
        let cIndex = 0;

        const chatTextarea = document.getElementById("chat-textarea");

        if (!chatTextarea) return; // Exit if element doesn't exist

        function type() {
            if (cIndex <= placeholderText.length) {
                // Add the caret to the end of the placeholder string
                chatTextarea.placeholder =
                    placeholderText.substring(0, cIndex) + "|";
                cIndex++;
                setTimeout(type, 60); // Typing speed
            } else {
                // Done typing, set final placeholder and remove caret animation
                chatTextarea.placeholder = placeholderText;
                chatTextarea.style.animation = "none"; // Stop blinking
            }
        }

        setTimeout(type, 1000); // Initial delay before starting
    })();

    // --- NEW: Textarea Auto-Resize ---
    const chatTextarea = document.getElementById("chat-textarea");
    if (chatTextarea) {
        chatTextarea.addEventListener("input", () => {
            chatTextarea.style.height = "auto"; // Reset height
            chatTextarea.style.height = chatTextarea.scrollHeight + "px"; // Set to scroll height
        });
    }

    // --- NEW: Dropdown Menu Logic ---
    const agentButton = document.getElementById("agent-mode-button");
    const agentDropdown = document.getElementById("agent-mode-dropdown");
    const agentModeText = document.getElementById("agent-mode-text");

    if (agentButton && agentDropdown && agentModeText) {
        agentButton.addEventListener("click", (e) => {
            e.preventDefault(); // Prevent form submission
            agentDropdown.classList.toggle("hidden");
        });

        // Add logic to select mode
        agentDropdown
            .querySelectorAll('button[role="menuitem"]')
            .forEach((item) => {
                item.addEventListener("click", () => {
                    const selectedMode = item.querySelector("span").textContent; // "Agent Mode" or "Ask Mode"
                    agentModeText.textContent = selectedMode;
                    agentDropdown.classList.add("hidden");
                });
            });

        window.addEventListener("click", (e) => {
            // Close if clicking outside the button and dropdown
            if (
                !agentButton.contains(e.target) &&
                !agentDropdown.contains(e.target)
            ) {
                agentDropdown.classList.add("hidden");
            }
        });
    }

    // --- NEW: Form Submission Logic ---
    const chatForm = document.getElementById("chat-form");
    if (chatForm) {
        chatForm.addEventListener("submit", (e) => {
            e.preventDefault(); // Stop page from reloading
            const query = chatTextarea.value;
            if (query.trim() === "") return; // Don't submit empty

            console.log("--- Form Submitted ---");
            console.log("Mode:", agentModeText.textContent.trim());
            console.log("Query:", query);
            console.log("Navigating to tester page...");

            // Navigate to tester page
            window.location.href = "http://localhost:3000/tester";
        });
    }
});
