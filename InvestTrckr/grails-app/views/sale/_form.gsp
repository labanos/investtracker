<%@ page import="investtrckr.Sale" %>



<div class="fieldcontain ${hasErrors(bean: saleInstance, field: 'date', 'error')} required">
	<label for="date">
		<g:message code="sale.date.label" default="Date" />
		<span class="required-indicator">*</span>
	</label>
	<g:datePicker name="date" precision="day"  value="${saleInstance?.date}"  />
</div>

<div class="fieldcontain ${hasErrors(bean: saleInstance, field: 'price', 'error')} required">
	<label for="price">
		<g:message code="sale.price.label" default="Price" />
		<span class="required-indicator">*</span>
	</label>
	<g:field name="price" value="${fieldValue(bean: saleInstance, field: 'price')}" required=""/>
</div>

<div class="fieldcontain ${hasErrors(bean: saleInstance, field: 'quantity', 'error')} required">
	<label for="quantity">
		<g:message code="sale.quantity.label" default="Quantity" />
		<span class="required-indicator">*</span>
	</label>
	<g:field name="quantity" type="number" value="${saleInstance.quantity}" required=""/>
</div>

<div class="fieldcontain ${hasErrors(bean: saleInstance, field: 'investment', 'error')} required">
	<label for="investment">
		<g:message code="sale.investment.label" default="Investment" />
		<span class="required-indicator">*</span>
	</label>
	<g:select id="investment" name="investment.id" from="${investtrckr.Investment.list()}" optionKey="id" required="" value="${saleInstance?.investment?.id}" class="many-to-one"/>
</div>

